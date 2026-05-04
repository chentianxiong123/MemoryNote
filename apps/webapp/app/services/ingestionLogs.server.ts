import { prisma } from "~/db.server";

export interface IngestionLog {
  id: string;
  documentId: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  data?: Record<string, unknown>;
}

export async function createIngestionLog(documentId: string): Promise<IngestionLog> {
  return {
    id: `log-${Date.now()}`,
    documentId,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function updateIngestionLog(
  id: string,
  data: Partial<IngestionLog>,
): Promise<IngestionLog | null> {
  return {
    id,
    documentId: "",
    status: data.status || "pending",
    error: data.error,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getIngestionLogByDocumentId(
  documentId: string,
): Promise<IngestionLog | null> {
  return null;
}

export async function deleteSession(
  sessionId: string,
  _userId?: string,
): Promise<{ logsDeleted: number; deleted: boolean }> {
  return { logsDeleted: 0, deleted: true };
}

export async function getPendingIngestionsForSession(
  sessionId: string,
): Promise<IngestionLog[]> {
  return [];
}
