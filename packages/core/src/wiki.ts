import type { WikiEntry, WikiEntryVersion, PrismaClient } from "@core/database";

export type WikiClient = Pick<PrismaClient, "wikiEntry" | "wikiEntryVersion" | "$transaction">;

export type WikiStatus = "DRAFT" | "PUBLISHED" | "REJECTED";
export type RejectReason = "INACCURATE" | "IRRELEVANT" | "DUPLICATE" | "TRIVIAL" | "OTHER";

export interface CreateWikiEntryParams {
  entityUuid: string;
  title: string;
  definition: string;
  summary: string;
  content: string;
  status?: WikiStatus;
}

export async function createWikiEntry(
  db: WikiClient,
  params: CreateWikiEntryParams,
): Promise<WikiEntry> {
  const { entityUuid, title, definition, summary, content, status = "DRAFT" } = params;

  const existing = await db.wikiEntry.findUnique({
    where: { entityUuid },
  });

  if (existing) {
    return updateWikiEntry(db, {
      wikiEntryId: existing.id,
      title,
      definition,
      summary,
      content,
    });
  }

  const entry = await db.wikiEntry.create({
    data: {
      entityUuid,
      title,
      definition,
      summary,
      content,
      status,
      reviewedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  await db.wikiEntryVersion.create({
    data: { wikiEntryId: entry.id, version: 1, title, definition, summary, content },
  });

  return entry;
}

export interface UpdateWikiEntryParams {
  wikiEntryId: string;
  title: string;
  definition: string;
  summary: string;
  content: string;
  sourceEpisodeUuid?: string;
}

export async function updateWikiEntry(
  db: WikiClient,
  params: UpdateWikiEntryParams,
): Promise<WikiEntry> {
  const { wikiEntryId, title, definition, summary, content, sourceEpisodeUuid } = params;

  const latest = await db.wikiEntryVersion.findFirst({
    where: { wikiEntryId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const [entry] = await db.$transaction([
    db.wikiEntry.update({
      where: { id: wikiEntryId },
      data: { title, definition, summary, content },
    }),
    db.wikiEntryVersion.create({
      data: {
        wikiEntryId,
        version: nextVersion,
        title,
        definition,
        summary,
        content,
        sourceEpisodeUuid,
      },
    }),
  ]);

  return entry;
}

export async function getWikiEntry(
  db: WikiClient,
  entityUuid: string,
): Promise<WikiEntry | null> {
  return db.wikiEntry.findUnique({
    where: { entityUuid },
  });
}

export async function getWikiEntryById(
  db: WikiClient,
  wikiEntryId: string,
): Promise<WikiEntry | null> {
  return db.wikiEntry.findUnique({ where: { id: wikiEntryId } });
}

export async function getWikiEntryVersions(
  db: WikiClient,
  wikiEntryId: string,
): Promise<WikiEntryVersion[]> {
  return db.wikiEntryVersion.findMany({
    where: { wikiEntryId },
    orderBy: { version: "desc" },
  });
}

export async function deleteWikiEntry(db: WikiClient, wikiEntryId: string): Promise<void> {
  await db.wikiEntryVersion.deleteMany({ where: { wikiEntryId } });
  await db.wikiEntry.delete({ where: { id: wikiEntryId } });
}

export interface ListWikiEntriesParams {
  limit?: number;
  offset?: number;
  status?: WikiStatus;
}

export async function getWikiEntries(
  db: WikiClient,
  params: ListWikiEntriesParams = {},
): Promise<WikiEntry[]> {
  const { limit = 50, offset = 0, status } = params;
  return db.wikiEntry.findMany({
    where: status ? { status } : {},
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getWikiEntryStatusCounts(db: WikiClient): Promise<Record<WikiStatus, number>> {
  const groups = await db.wikiEntry.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts: Record<WikiStatus, number> = { DRAFT: 0, PUBLISHED: 0, REJECTED: 0 };
  for (const g of groups) {
    counts[g.status as WikiStatus] = g._count._all;
  }
  return counts;
}

export async function publishWikiEntry(db: WikiClient, wikiEntryId: string): Promise<WikiEntry> {
  return db.wikiEntry.update({
    where: { id: wikiEntryId },
    data: { status: "PUBLISHED", reviewedAt: new Date() },
  });
}

export async function publishWikiEntryByEntity(
  db: WikiClient,
  entityUuid: string,
): Promise<WikiEntry | null> {
  const entry = await db.wikiEntry.findUnique({
    where: { entityUuid },
  });
  if (!entry || entry.status !== "DRAFT") return entry ?? null;
  return publishWikiEntry(db, entry.id);
}

export interface RejectWikiEntryParams {
  wikiEntryId: string;
  reason?: RejectReason;
  notes?: string;
}

export async function rejectWikiEntry(
  db: WikiClient,
  params: RejectWikiEntryParams,
): Promise<WikiEntry> {
  const { wikiEntryId, reason, notes } = params;
  return db.wikiEntry.update({
    where: { id: wikiEntryId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      rejectReason: reason ?? null,
      reviewNotes: notes?.trim() || null,
    },
  });
}

export interface SearchWikiEntriesParams {
  query: string;
  limit?: number;
}

export async function searchWikiEntries(
  db: WikiClient,
  params: SearchWikiEntriesParams,
): Promise<WikiEntry[]> {
  const { query, limit = 20 } = params;
  return db.wikiEntry.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { definition: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
