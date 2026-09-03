import { z } from "zod";
import type { Prisma, PrismaClient } from "@core/database";

export const DocumentSourceSchema = z.enum([
  "upload",
  "api",
  "chat",
  "import",
  "whatsapp",
  "persona",
  "persona-v2",
  "skill",
  "core",
  "对话",
  "对话文档",
  "deepseek-export",
]);
export type DocumentSource = z.infer<typeof DocumentSourceSchema>;

export type DocumentClient = Pick<PrismaClient, "document" | "ingestionQueue">;

export interface DocumentSearchParams {
  query?: string;
  labelIds?: string[];
  limit?: number;
}

export interface DocumentSearchResult {
  id: string;
  sessionId: string | null;
  title: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function searchDocuments(
  db: DocumentClient,
  params: DocumentSearchParams,
): Promise<DocumentSearchResult[]> {
  const { query, labelIds, limit = 50 } = params;

  const conditions: Prisma.DocumentWhereInput[] = [{ deleted: null }];
  if (query?.trim()) {
    conditions.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  if (labelIds && labelIds.length > 0) {
    conditions.push({ labelIds: { hasSome: labelIds } });
  }

  return db.document.findMany({
    where: { AND: conditions },
    select: {
      id: true,
      sessionId: true,
      title: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
}

export async function searchDocumentSessionIds(
  db: DocumentClient,
  params: DocumentSearchParams,
): Promise<string[]> {
  const { query, labelIds, limit = 100 } = params;

  const conditions: Prisma.DocumentWhereInput[] = [
    { deleted: null },
    { sessionId: { not: null } },
  ];
  if (query?.trim()) {
    conditions.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  if (labelIds && labelIds.length > 0) {
    conditions.push({ labelIds: { hasSome: labelIds } });
  }

  const docs = await db.document.findMany({
    where: { AND: conditions },
    select: { sessionId: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
  return [...new Set(docs.map((d) => d.sessionId).filter((s): s is string => Boolean(s)))];
}

export type DocumentWithIngestion = NonNullable<
  Awaited<ReturnType<PrismaClient["document"]["findUnique"]>>
> & {
  latestIngestionLog: Awaited<
    ReturnType<PrismaClient["ingestionQueue"]["findFirst"]>
  >;
  ingestionQueueCount: number;
  error?: unknown;
  status?: string;
};

export async function getDocument(db: DocumentClient, id: string) {
  const document = await db.document.findUnique({ where: { id } });
  if (!document) return null;

  const [latestIngestionLog, ingestionQueueCount] = await Promise.all([
    db.ingestionQueue.findFirst({
      where: { sessionId: document.sessionId },
      orderBy: { createdAt: "desc" },
    }),
    db.ingestionQueue.count({ where: { sessionId: document.sessionId } }),
  ]);

  return {
    ...document,
    latestIngestionLog,
    ingestionQueueCount,
    error: latestIngestionLog?.error,
    status: latestIngestionLog?.status,
  };
}

export async function getDocumentForSession(db: DocumentClient, sessionId: string) {
  const document = await db.document.findUnique({ where: { sessionId } });
  if (!document) return null;

  const [latestIngestionLog, ingestionQueueCount] = await Promise.all([
    db.ingestionQueue.findFirst({
      where: { sessionId: document.sessionId },
      orderBy: { createdAt: "desc" },
    }),
    db.ingestionQueue.count({ where: { sessionId: document.sessionId } }),
  ]);

  return {
    ...document,
    latestIngestionLog,
    ingestionQueueCount,
    error: latestIngestionLog?.error,
    status: latestIngestionLog?.status,
  };
}

export interface DocumentUpdateParams {
  title?: string;
  labelIds?: string[];
}

export async function updateDocument(
  db: DocumentClient,
  id: string,
  updateData: DocumentUpdateParams,
) {
  return db.document.update({
    where: { id },
    data: { title: updateData.title, labelIds: updateData.labelIds },
  });
}

export async function deleteDocument(db: DocumentClient, id: string) {
  return db.document.delete({ where: { id } });
}

export async function getPersonaForUser(db: DocumentClient): Promise<string | undefined> {
  const v2 = await db.document.findFirst({
    where: { title: "Persona", source: "persona-v2" },
    orderBy: { createdAt: "desc" },
  });
  if (v2) return v2.id;
  const v1 = await db.document.findFirst({
    where: { title: "Persona", source: "persona" },
    orderBy: { createdAt: "desc" },
  });
  return v1?.id;
}

export async function getPersonaDocumentForUser(db: DocumentClient): Promise<string | null> {
  const persona = await db.document.findFirst({
    where: { type: "skill", title: "Persona", deleted: null },
  });
  return persona?.content ?? null;
}
