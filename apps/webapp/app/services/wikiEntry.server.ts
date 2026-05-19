import { type WikiEntry, type WikiEntryVersion, type PrismaClient } from "@prisma/client";
import { logger } from "./logger.service";
import { ProviderFactory } from "@core/providers";

// Get the graph provider instance
const graphProvider = () => ProviderFactory.getGraphProvider();

/**
 * Create a new wiki entry for an entity
 * If an entry already exists for the entity, update it instead.
 * `status` defaults to DRAFT — entries become PUBLISHED only after user review
 * (or when the corresponding entity is accepted from the Inbox).
 */
export async function createWikiEntry(params: {
  entityUuid: string;
  title: string;
  definition: string;
  summary: string;
  content: string;
  userId: string;
  workspaceId: string;
  prisma: PrismaClient;
  status?: "DRAFT" | "PUBLISHED";
}): Promise<WikiEntry> {
  const { entityUuid, title, definition, summary, content, userId, workspaceId, prisma, status = "DRAFT" } = params;

  // Check if a wiki entry already exists for this entity
  const existingEntry = await prisma.wikiEntry.findUnique({
    where: {
      entityUuid_workspaceId: {
        entityUuid,
        workspaceId,
      },
    },
  });

  if (existingEntry) {
    // Update existing entry and create a new version. Preserve existing
    // status — re-extracting an already-PUBLISHED entry must not silently
    // demote it back to DRAFT.
    logger.info(`Wiki entry already exists for entity ${entityUuid}, updating...`, {
      wikiEntryId: existingEntry.id,
    });

    return updateWikiEntry({
      wikiEntryId: existingEntry.id,
      title,
      definition,
      summary,
      content,
      prisma,
    });
  }

  // Create new wiki entry (DRAFT by default — must pass user review)
  const wikiEntry = await prisma.wikiEntry.create({
    data: {
      entityUuid,
      title,
      definition,
      summary,
      content,
      status,
      reviewedAt: status === "PUBLISHED" ? new Date() : null,
      userId,
      workspaceId,
    },
  });

  // Create the first version
  await prisma.wikiEntryVersion.create({
    data: {
      wikiEntryId: wikiEntry.id,
      version: 1,
      title,
      definition,
      summary,
      content,
    },
  });

  logger.info(`Created wiki entry for entity ${entityUuid}`, {
    wikiEntryId: wikiEntry.id,
  });

  return wikiEntry;
}

/**
 * Update a wiki entry and create a new version
 */
export async function updateWikiEntry(params: {
  wikiEntryId: string;
  title: string;
  definition: string;
  summary: string;
  content: string;
  sourceEpisodeUuid?: string;
  prisma: PrismaClient;
}): Promise<WikiEntry> {
  const { wikiEntryId, title, definition, summary, content, sourceEpisodeUuid, prisma } = params;

  // Get the current latest version number
  const latestVersion = await prisma.wikiEntryVersion.findFirst({
    where: { wikiEntryId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  // Create new version in a transaction
  const [wikiEntry] = await prisma.$transaction([
    // Update the wiki entry
    prisma.wikiEntry.update({
      where: { id: wikiEntryId },
      data: {
        title,
        definition,
        summary,
        content,
      },
    }),
    // Create a new version record
    prisma.wikiEntryVersion.create({
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

  logger.info(`Updated wiki entry ${wikiEntryId} to version ${nextVersion}`);

  return wikiEntry;
}

/**
 * Get a wiki entry by entity UUID
 */
export async function getWikiEntry(params: {
  entityUuid: string;
  userId: string;
  workspaceId: string;
  prisma: PrismaClient;
}): Promise<WikiEntry | null> {
  const { entityUuid, workspaceId, prisma } = params;

  const wikiEntry = await prisma.wikiEntry.findUnique({
    where: {
      entityUuid_workspaceId: {
        entityUuid,
        workspaceId,
      },
    },
  });

  return wikiEntry;
}

/**
 * Get wiki entry versions
 */
export async function getWikiEntryVersions(params: {
  wikiEntryId: string;
  prisma: PrismaClient;
}): Promise<WikiEntryVersion[]> {
  const { wikiEntryId, prisma } = params;

  const versions = await prisma.wikiEntryVersion.findMany({
    where: { wikiEntryId },
    orderBy: { version: "desc" },
  });

  return versions;
}

/**
 * Get wiki entry timeline (aggregated statements related to the entity)
 * This function queries Neo4j for statements involving the entity
 */
export async function getWikiEntryTimeline(params: {
  entityUuid: string;
  userId: string;
  workspaceId: string;
  prisma: PrismaClient;
}): Promise<
  Array<{
    uuid: string;
    fact: string;
    aspect: string | null;
    validAt: Date;
    source: string;
  }>
> {
  const { entityUuid, userId, workspaceId } = params;

  // Query Neo4j for all statements involving this entity (as subject, predicate, or object)
  const query = `
    MATCH (e:Entity {uuid: $entityUuid})
    // Match as subject
    OPTIONAL MATCH (e)-[:SUBJECT]->(s1:Statement)
    WHERE s1.userId = $userId AND (s1.workspaceId = $workspaceId OR s1.workspaceId IS NULL)
    // Match as predicate
    OPTIONAL MATCH (e)-[:PREDICATE]->(s2:Statement)
    WHERE s2.userId = $userId AND (s2.workspaceId = $workspaceId OR s2.workspaceId IS NULL)
    // Match as object
    OPTIONAL MATCH (e)-[:OBJECT]->(s3:Statement)
    WHERE s3.userId = $userId AND (s3.workspaceId = $workspaceId OR s3.workspaceId IS NULL)

    // Collect all unique statements
    WITH COLLECT(DISTINCT s1) + COLLECT(DISTINCT s2) + COLLECT(DISTINCT s3) AS allStatements
    UNWIND allStatements AS s
    WITH DISTINCT s
    WHERE s IS NOT NULL AND s.invalidAt IS NULL

    // Get the source episode for each statement
    OPTIONAL MATCH (ep:Episode)-[:HAS_PROVENANCE]->(s)

    RETURN
      s.uuid AS uuid,
      s.fact AS fact,
      s.aspect AS aspect,
      s.validAt AS validAt,
      ep.source AS source
    ORDER BY s.validAt DESC
    LIMIT 100
  `;

  try {
    const results = await graphProvider().runQuery(query, {
      entityUuid,
      userId,
      workspaceId,
    });

    return results.map((record: Record<string, any>) => ({
      uuid: record.uuid || record.get?.("uuid"),
      fact: record.fact || record.get?.("fact"),
      aspect: record.aspect || record.get?.("aspect") || null,
      validAt: new Date(record.validAt || record.get?.("validAt")),
      source: record.source || record.get?.("source") || "unknown",
    }));
  } catch (error) {
    logger.error(`Failed to get wiki entry timeline for entity ${entityUuid}`, { error });
    return [];
  }
}

/**
 * Get a wiki entry by its ID
 */
export async function getWikiEntryById(params: {
  wikiEntryId: string;
  prisma: PrismaClient;
}): Promise<WikiEntry | null> {
  const { wikiEntryId, prisma } = params;

  return prisma.wikiEntry.findUnique({
    where: { id: wikiEntryId },
  });
}

/**
 * Delete a wiki entry and all its versions
 */
export async function deleteWikiEntry(params: {
  wikiEntryId: string;
  prisma: PrismaClient;
}): Promise<void> {
  const { wikiEntryId, prisma } = params;

  // Delete versions first (cascade should handle this, but being explicit)
  await prisma.wikiEntryVersion.deleteMany({
    where: { wikiEntryId },
  });

  // Delete the wiki entry
  await prisma.wikiEntry.delete({
    where: { id: wikiEntryId },
  });

  logger.info(`Deleted wiki entry ${wikiEntryId}`);
}

/**
 * Get all wiki entries for a workspace
 */
export async function getWikiEntriesByWorkspace(params: {
  workspaceId: string;
  prisma: PrismaClient;
  limit?: number;
  offset?: number;
  status?: "DRAFT" | "PUBLISHED" | "REJECTED";
}): Promise<WikiEntry[]> {
  const { workspaceId, prisma, limit = 50, offset = 0, status } = params;

  return prisma.wikiEntry.findMany({
    where: {
      workspaceId,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });
}

/**
 * Count entries for each status in the workspace.
 */
export async function getWikiEntryStatusCounts(params: {
  workspaceId: string;
  prisma: PrismaClient;
}): Promise<{ DRAFT: number; PUBLISHED: number; REJECTED: number }> {
  const { workspaceId, prisma } = params;
  const groups = await prisma.wikiEntry.groupBy({
    by: ["status"],
    where: { workspaceId },
    _count: { _all: true },
  });
  const counts = { DRAFT: 0, PUBLISHED: 0, REJECTED: 0 };
  for (const g of groups) {
    counts[g.status as keyof typeof counts] = g._count._all;
  }
  return counts;
}

/**
 * Publish a wiki entry (DRAFT → PUBLISHED). Idempotent.
 */
export async function publishWikiEntry(params: {
  wikiEntryId: string;
  prisma: PrismaClient;
}): Promise<WikiEntry> {
  const { wikiEntryId, prisma } = params;
  return prisma.wikiEntry.update({
    where: { id: wikiEntryId },
    data: { status: "PUBLISHED", reviewedAt: new Date() },
  });
}

/**
 * Publish the draft entry tied to a given entity, if one exists and is DRAFT.
 * Returns the entry if it was published, null if there is no entry or it's
 * already in another status. Used by Inbox accept flow.
 */
export async function publishWikiEntryByEntity(params: {
  entityUuid: string;
  workspaceId: string;
  prisma: PrismaClient;
}): Promise<WikiEntry | null> {
  const { entityUuid, workspaceId, prisma } = params;
  const entry = await prisma.wikiEntry.findUnique({
    where: { entityUuid_workspaceId: { entityUuid, workspaceId } },
  });
  if (!entry || entry.status !== "DRAFT") return entry ?? null;
  return publishWikiEntry({ wikiEntryId: entry.id, prisma });
}

/**
 * Reject a wiki entry (DRAFT → REJECTED). Keeps the row for audit.
 */
export async function rejectWikiEntry(params: {
  wikiEntryId: string;
  prisma: PrismaClient;
}): Promise<WikiEntry> {
  const { wikiEntryId, prisma } = params;
  return prisma.wikiEntry.update({
    where: { id: wikiEntryId },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
}

/**
 * Search wiki entries by title or content
 */
export async function searchWikiEntries(params: {
  query: string;
  workspaceId: string;
  prisma: PrismaClient;
  limit?: number;
}): Promise<WikiEntry[]> {
  const { query, workspaceId, prisma, limit = 20 } = params;

  return prisma.wikiEntry.findMany({
    where: {
      workspaceId,
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
