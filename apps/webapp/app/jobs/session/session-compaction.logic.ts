/**
 * Session compaction stub - disabled.
 */

export interface SessionCompactionPayload {
  sessionId: string;
  userId: string;
  workspaceId: string;
}

export async function processSessionCompaction(
  _payload: SessionCompactionPayload,
): Promise<{ success: boolean }> {
  return { success: false };
}
