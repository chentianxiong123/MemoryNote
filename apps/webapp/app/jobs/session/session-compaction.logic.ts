import { prisma } from "~/db.server";

export interface SessionCompactionPayload {
  sessionId: string;
  userId: string;
  workspaceId: string;
  source?: string;
}

export interface SessionCompactionResult {
  success: boolean;
  sessionId: string;
  compactedCount?: number;
}

export async function compactSession(
  sessionId: string,
  options?: { preserveRecent?: number },
): Promise<SessionCompactionResult> {
  return {
    success: true,
    sessionId,
    compactedCount: 0,
  };
}

export async function getSessionForCompaction(sessionId: string) {
  return prisma.conversation.findUnique({
    where: { id: sessionId },
  });
}
