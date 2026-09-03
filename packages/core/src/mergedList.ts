import type { PrismaClient } from "@core/database";

export type DocumentClient = Pick<PrismaClient, "document" | "conversation">;

export type MemoryItemKind = "document" | "conversation";

export interface MemoryItem {
  kind: MemoryItemKind;
  id: string;
  title: string;
  source: string;
  updatedAt: Date;
  excerpt: string | null;
  sessionId: string | null;
}

export interface MergedListResult {
  items: MemoryItem[];
  totalCount: number;
  docCount: number;
  convCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MergedListOptions {
  page?: number;
  limit?: number;
  source?: "upload" | "对话" | "all";
  search?: string;
  excerptChars?: number;
}

function makeExcerpt(content: string | null | undefined, max: number): string | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max) + "…";
}

export async function listMergedMemory(
  db: DocumentClient,
  opts: MergedListOptions = {},
): Promise<MergedListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;
  const excerptChars = opts.excerptChars ?? 120;
  const source = opts.source ?? "all";
  const search = opts.search?.trim() || undefined;

  const docWhere = {
    deleted: null,
    ...(source === "对话" ? { id: { equals: "__never__" } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { content: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const convWhere = {
    deleted: null,
    ...(source === "upload" ? { id: { equals: "__never__" } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            {
              ConversationHistory: {
                some: { message: { contains: search, mode: "insensitive" as const } },
              },
            },
          ],
        }
      : {}),
  };

  const [docs, conversations, docTotal, convTotal] = await Promise.all([
    db.document.findMany({
      where: docWhere,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        source: true,
        updatedAt: true,
        content: true,
        sessionId: true,
      },
    }),
    db.conversation.findMany({
      where: convWhere,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        source: true,
        updatedAt: true,
        asyncJobId: true,
        ConversationHistory: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { message: true },
        },
      },
    }),
    db.document.count({ where: docWhere }),
    db.conversation.count({ where: convWhere }),
  ]);

  const totalCount = docTotal + convTotal;

  const docItems: MemoryItem[] = docs.map((d) => ({
    kind: "document",
    id: d.id,
    title: d.title ?? "(无标题)",
    source: d.source,
    updatedAt: d.updatedAt,
    excerpt: makeExcerpt(d.content, excerptChars),
    sessionId: d.sessionId,
  }));

  const convItems: MemoryItem[] = conversations.map((c) => ({
    kind: "conversation",
    id: c.id,
    title: c.title ?? "(无标题)",
    source: c.source,
    updatedAt: c.updatedAt,
    excerpt: c.ConversationHistory[0]?.message
      ? makeExcerpt(c.ConversationHistory[0].message, excerptChars)
      : null,
    sessionId: c.asyncJobId,
  }));

  const merged = [...docItems, ...convItems].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  const items = merged.slice(skip, skip + limit);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    items,
    totalCount,
    docCount: docTotal,
    convCount: convTotal,
    page,
    limit,
    totalPages,
  };
}
