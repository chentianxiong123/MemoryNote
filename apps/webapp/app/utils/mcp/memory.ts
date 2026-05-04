/**
 * MCP Memory Tools - Simplified
 */

import { z } from "zod";
import { searchMemoryWithAgent } from "~/services/agent/memory";
import { prisma } from "~/db.server";
import { logger } from "~/services/logger.service";

// Memory tool definitions
export const memoryTools = [
  {
    name: "search_memory",
    description:
      "Search your memory for relevant context. Use this to find information from past conversations, documents, and knowledge.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for in your memory",
        },
      },
      required: ["query"],
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  {
    name: "user_profile",
    description: "Get the user's profile information",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  {
    name: "memory_ingest",
    description: "Store new information in memory",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to store in memory",
        },
        type: {
          type: "string",
          description: "Type of memory (note, fact, preference)",
        },
      },
      required: ["content"],
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
];

// Handle memory tool calls
export async function callMemoryTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  source: string,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    switch (toolName) {
      case "search_memory": {
        const query = args.query as string;
        const workspaceId = args.workspaceId as string;
        const result = await searchMemoryWithAgent(
          query,
          userId,
          workspaceId,
          source,
          { structured: false },
        );

        if (result && typeof result === "object" && "content" in result) {
          return result as { content: Array<{ type: string; text: string }> };
        }

        return {
          content: [{ type: "text", text: "No results found" }],
        };
      }

      case "user_profile": {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  name: user?.name || "Unknown",
                  email: user?.email || "Unknown",
                  timezone: "UTC",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "memory_ingest": {
        const content = args.content as string;
        const workspaceId = args.workspaceId as string;

        await prisma.document.create({
          data: {
            title: content.slice(0, 100),
            content,
            type: "note",
            workspaceId,
            source: "mcp",
            editedBy: userId,
          },
        });

        return {
          content: [{ type: "text", text: "Memory stored successfully" }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        };
    }
  } catch (error) {
    logger.error("Memory tool error", { error, toolName });
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
    };
  }
}
