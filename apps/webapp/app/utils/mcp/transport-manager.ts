/**
 * MCP Transport Manager - Simplified
 */

interface SessionInfo {
  exists: boolean;
  mainTransport?: unknown;
  source?: string;
  workspaceId?: string;
}

const transports = new Map<
  string,
  { transport: unknown; source: string; workspaceId: string }
>();

export const TransportManager = {
  storeSession(
    sessionId: string,
    transport: unknown,
    source: string,
    workspaceId: string,
  ): void {
    transports.set(sessionId, { transport, source, workspaceId });
  },

  getSessionInfo(sessionId: string): SessionInfo {
    const data = transports.get(sessionId);
    if (!data) {
      return { exists: false };
    }
    return {
      exists: true,
      mainTransport: data.transport,
      source: data.source,
      workspaceId: data.workspaceId,
    };
  },

  async cleanupSession(sessionId: string): Promise<void> {
    transports.delete(sessionId);
  },
};
