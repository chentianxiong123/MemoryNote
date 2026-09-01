import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { prisma } from "~/db.server";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

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
    const q = searchParams.q;

    if (!"personal") {
      throw new Response("Workspace not found", { status: 404 });
    }

    // Build available sources list
    const [docSourcesResult, convSourcesResult] = await Promise.all([
      prisma.$queryRaw<Array<{ source: string }>>`
        SELECT DISTINCT source FROM "Document"
        WHERE deleted IS NULL AND source IS NOT NULL ORDER BY source
      `,
      prisma.$queryRaw<Array<{ source: string }>>`
        SELECT '对话' as source
        WHERE EXISTS (SELECT 1 FROM "Conversation" WHERE source='deepseek-export' AND deleted IS NULL LIMIT 1)
      `,
    ]);

    const sourcesMap = new Map<string, { name: string; slug: string }>();
    docSourcesResult.forEach(({ source }) => {
      if (source) {
        const slug = source.toLowerCase().replace(/\s+/g, "-");
        if (!sourcesMap.has(slug)) {
          sourcesMap.set(slug, { name: source, slug });
        }
      }
    });
    convSourcesResult.forEach(({ source }) => {
      if (source && !sourcesMap.has(source.toLowerCase())) {
        sourcesMap.set(source.toLowerCase(), { name: source, slug: source.toLowerCase() });
      }
    });
    const availableSources = Array.from(sourcesMap.values());

    const skip = Math.max(0, (page - 1) * limit);

    // Handle 对话 source
    if (source === "对话" || source === "conversation") {
      const whereClause: any = {
        deleted: null,
      };
      if (q?.trim()) {
        whereClause.title = { contains: q.trim(), mode: "insensitive" };
      }

      const [conversations, totalCount] = await Promise.all([
        prisma.conversation.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: { id: true, title: true, createdAt: true, updatedAt: true, source: true },
        }),
        prisma.conversation.count({ where: whereClause }),
      ]);

      const docs = conversations.map((c) => ({
        id: c.id,
        title: c.title || "(无标题)",
        source: "对话",
        type: "conversation",
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        status: null,
        ingestionQueueCount: 0,
        labelIds: [],
      }));

      return json({
        documents: docs,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
        availableSources,
        totalCount,
      });
    }

    // Default: Document table
    const whereClause: any = { deleted: null };

    if (source) {
      whereClause.source = source;
    }

    if (q?.trim()) {
      whereClause.OR = [
        { title: { contains: q.trim(), mode: "insensitive" } },
        { content: { contains: q.trim(), mode: "insensitive" } },
      ];
    }

    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.document.count({ where: whereClause }),
    ]);

    const documentIds = documents.map((d) => d.sessionId).filter(Boolean) as string[];

    const [latestLogs, queueCounts] =
      documentIds.length > 0
        ? await Promise.all([
            prisma.ingestionQueue.findMany({
              where: { sessionId: { in: documentIds } },
              select: { id: true, sessionId: true, status: true, error: true },
              orderBy: { createdAt: "desc" },
              distinct: ["sessionId"],
            }),
            prisma.ingestionQueue.groupBy({
              by: ["sessionId"],
              where: { sessionId: { in: documentIds } },
              _count: { id: true },
            }),
          ])
        : [[], []];

    const latestLogMap = new Map(latestLogs.map((log) => [log.sessionId, log]));
    const countMap = new Map(queueCounts.map((count) => [count.sessionId, count._count.id]));

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
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1,
      availableSources,
      totalCount,
    });
  },
);
