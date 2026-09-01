import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { prisma } from "~/db.server";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

// Schema for logs search parameters
const DocumentsSearchParams = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  sessionId: z.string().optional(),
  label: z.string().optional(),
  q: z.string().optional(),
});

export const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    searchParams: DocumentsSearchParams,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication, searchParams }) => {
    const page = parseInt(searchParams.page || "1");
    const limit = parseInt(searchParams.limit || "20");
    const source = searchParams.source;
    const status = searchParams.status;
    const type = searchParams.type;
    const sessionId = searchParams.sessionId;
    const label = searchParams.label;
    const q = searchParams.q;

    if (!"personal") {
      throw new Response("Workspace not found", { status: 404 });
    }

    // Get unique sources from document data field using raw SQL
    const uniqueDataSources = await prisma.$queryRaw<Array<{ source: string }>>`
      SELECT DISTINCT source
      FROM "Document"
      WHERE deleted IS NULL AND source IS NOT NULL
      ORDER BY source
    `;

    // Build sources map from data sources
    const sourcesMap = new Map<string, { name: string; slug: string }>();
    uniqueDataSources.forEach(({ source }) => {
      if (source) {
        const slug = source.toLowerCase().replace(/\s+/g, "-");
        if (!sourcesMap.has(slug)) {
          sourcesMap.set(slug, { name: source, slug });
        }
      }
    });

    const availableSources = Array.from(sourcesMap.values());

    // Build where clause for filtering
    const whereClause: any = {
      deleted: null,
    };

    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    if (source) {
      whereClause.source = source;
    }

    if (status) {
      whereClause.status = status;
    }

    if (type) {
      whereClause.type = type;
    } else {
      // Exclude skill documents by default
      whereClause.type = { not: "skill" };
    }

    if (label) {
      if (label === "no_label") {
        whereClause.labelIds = {
          isEmpty: true,
        };
      } else {
        whereClause.labelIds = {
          has: label,
        };
      }
    }

    // Add text search on title and content
    if (q && q.trim()) {
      whereClause.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ];
    }

    // Calculate skip for page-based pagination
    const skip = Math.max(0, (page - 1) * limit);

    // Fetch Documents with simple pagination - no deduplication
    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where: whereClause,
        orderBy: {
          createdAt: "desc",
        },
        skip: skip,
        take: limit,
      }),
      prisma.document.count({
        where: whereClause,
      }),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Get document IDs for ingestion queue lookups
    const documentIds = documents
      .map((d) => d.sessionId)
      .filter(Boolean) as string[];

    // Fetch latest ingestion logs and counts in parallel for all documents
    const [latestLogs, queueCounts] =
      documentIds.length > 0
        ? await Promise.all([
            // Get latest log for each sessionId (document.id)
            prisma.ingestionQueue.findMany({
              where: {
                sessionId: { in: documentIds },
              },
              select: {
                id: true,
                sessionId: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                error: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              distinct: ["sessionId"],
            }),
            // Get count for each sessionId
            prisma.ingestionQueue.groupBy({
              by: ["sessionId"],
              where: {
                sessionId: { in: documentIds },
              },
              _count: {
                id: true,
              },
            }),
          ])
        : [[], []];

    // Create lookup maps for O(1) access
    const latestLogMap = new Map(latestLogs.map((log) => [log.sessionId, log]));
    const countMap = new Map(
      queueCounts.map((count) => [count.sessionId, count._count.id]),
    );

    // Augment documents with ingestion queue data
    const documentsWithQueueData = documents.map((doc) => ({
      ...doc,
      status: latestLogMap.get(doc.sessionId)?.status || null,
      error: latestLogMap.get(doc.sessionId)?.error || null,
      ingestionQueueCount: countMap.get(doc.sessionId) || 0,
    }));

    return json({
      documents: documentsWithQueueData,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPrevPage,
      availableSources,
      totalCount,
    });
  },
);
