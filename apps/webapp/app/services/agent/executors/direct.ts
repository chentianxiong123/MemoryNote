/**
 * DirectOrchestratorTools
 *
 * Simplified implementation for personal use.
 */

import { searchMemoryWithAgent } from "../memory";
import { prisma } from "~/db.server";
import { logger } from "../../logger.service";
import { OrchestratorTools } from "./base";

export class DirectOrchestratorTools extends OrchestratorTools {
  async searchMemory(
    query: string,
    userId: string,
    workspaceId: string,
    source: string,
  ): Promise<string> {
    try {
      const result = await searchMemoryWithAgent(
        query,
        userId,
        workspaceId,
        source,
        {
          structured: false,
        },
      );
      if (result && typeof result === "object" && "content" in result) {
        const content = (result as any).content;
        if (Array.isArray(content) && content.length > 0) {
          return content[0].text ?? "nothing found";
        }
      }
      return "nothing found";
    } catch (error) {
      logger.warn("DirectOrchestratorTools: memory search failed", { error });
      return "nothing found";
    }
  }

  async getSkill(skillId: string, workspaceId: string): Promise<string> {
    try {
      const skill = await prisma.document.findFirst({
        where: { id: skillId, workspaceId, type: "skill", deleted: null },
        select: { id: true, title: true, content: true },
      });
      if (!skill) return "Skill not found";
      return `## Skill: ${skill.title}\n\n${skill.content}`;
    } catch (error) {
      logger.warn("DirectOrchestratorTools: failed to load skill", { error });
      return "Failed to load skill";
    }
  }
}
