import { json } from "@remix-run/node";
import { z } from "zod";
import { prisma } from "~/db.server";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

// Schema for wiki entries search parameters
const WikiEntriesSearchParams = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export const loader = createHybridLoaderApiRoute(
  {
    allowJWT: true,
    searchParams: WikiEntriesSearchParams,
    corsStrategy: "all",
    findResource: async () => 1,
  },
  async ({ authentication, searchParams }) => {
    const page = parseInt(searchParams.page || "1");
    const limit = parseInt(searchParams.limit || "25");
    const search = searchParams.search;

    if (!authentication.workspaceId) {
      throw new Response("Workspace not found", { status: 404 });
    }

    const offset = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      workspaceId: authentication.workspaceId,
    };

    // Add search filter if provided
    if (search && search.trim()) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { definition: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch wiki entries with pagination
    const [entries, totalCount] = await Promise.all([
      prisma.wikiEntry.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          entityUuid: true,
          title: true,
          definition: true,
          summary: true,
          updatedAt: true,
        },
      }),
      prisma.wikiEntry.count({
        where: whereClause,
      }),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return json({
      entries,
      page,
      limit,
      totalCount,
      totalPages,
      hasMore,
    });
  },
);
