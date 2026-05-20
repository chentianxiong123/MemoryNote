import { json } from "@remix-run/node";
import { z } from "zod";
import { prisma } from "~/db.server";

import { createHybridLoaderApiRoute } from "~/services/routeBuilders/apiBuilder.server";

// Schema for wiki entries search parameters
const WikiEntriesSearchParams = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "REJECTED"]).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
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
    const status = searchParams.status;
    const sortBy = searchParams.sortBy || "updatedAt";
    const sortOrder = searchParams.sortOrder || "desc";

    if (!authentication.workspaceId) {
      throw new Response("Workspace not found", { status: 404 });
    }

    const offset = (page - 1) * limit;

    const whereClause: any = {
      workspaceId: authentication.workspaceId,
    };

    if (status) {
      whereClause.status = status;
    }

    if (search && search.trim()) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { definition: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [entries, totalCount, statusCounts] = await Promise.all([
      prisma.wikiEntry.findMany({
        where: whereClause,
        orderBy,
        take: limit,
        skip: offset,
        select: {
          id: true,
          entityUuid: true,
          title: true,
          definition: true,
          summary: true,
          status: true,
          updatedAt: true,
          rejectReason: true,
          reviewNotes: true,
        },
      }),
      prisma.wikiEntry.count({ where: whereClause }),
      prisma.wikiEntry.groupBy({
        by: ["status"],
        where: { workspaceId: authentication.workspaceId },
        _count: { _all: true },
      }),
    ]);

    const counts = { DRAFT: 0, PUBLISHED: 0, REJECTED: 0 };
    for (const g of statusCounts) {
      counts[g.status as keyof typeof counts] = g._count._all;
    }

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return json({
      entries,
      page,
      limit,
      totalCount,
      totalPages,
      hasMore,
      statusCounts: counts,
    });
  },
);
