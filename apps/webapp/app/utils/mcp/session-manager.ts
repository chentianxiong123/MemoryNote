/**
 * MCP Session Manager - Simplified
 */

import { prisma } from "~/db.server";

interface SessionData {
  workspaceId: string;
  source: string;
  createdAt: Date;
}

const sessions = new Map<string, SessionData>();

export const MCPSessionManager = {
  async createSession(
    sessionId: string,
    workspaceId: string,
    source: string,
  ): Promise<void> {
    sessions.set(sessionId, {
      workspaceId,
      source,
      createdAt: new Date(),
    });
  },

  async getSession(sessionId: string): Promise<SessionData | null> {
    return sessions.get(sessionId) || null;
  },

  async deleteSession(sessionId: string): Promise<void> {
    sessions.delete(sessionId);
  },

  async isSessionActive(
    sessionId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const session = sessions.get(sessionId);
    return session?.workspaceId === workspaceId;
  },
};
