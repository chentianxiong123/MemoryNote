/**
 * Core Agent Tool & Agent Assembly - Simplified for personal use
 */

import { type Tool, tool } from "ai";
import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";

import { type OrchestratorTools } from "../executors/base";
import { getDefaultChatModelId } from "~/services/llm-provider.server";
import { type ModelConfig } from "~/services/llm-provider.server";

interface CreateCoreToolsParams {
  userId: string;
  workspaceId: string;
  source: string;
  conversationId: string;
  executorTools?: OrchestratorTools;
  executor?: OrchestratorTools;
  interactive?: boolean;
  timezone?: string;
  readOnly?: boolean;
  skills?: unknown[];
  onMessage?: (message: string) => Promise<void>;
  defaultChannel?: string;
  availableChannels?: string[];
  isBackgroundExecution?: boolean;
}

// Core tools - memory search only
export async function createCoreTools(
  params: CreateCoreToolsParams,
): Promise<Record<string, Tool>> {
  const { workspaceId, userId, source, executorTools, executor } = params;
  const resolvedExecutor = executorTools ?? executor;

  const tools: Record<string, Tool> = {};

  // Memory search tool
  tools["search_memory"] = tool({
    description: "Search your memory for relevant context",
    inputSchema: z.object({
      query: z.string().describe("What to search for"),
    }),
    execute: async ({ query }) => {
      if (!resolvedExecutor) {
        return "Memory search not available";
      }
      return resolvedExecutor.searchMemory(query, userId, workspaceId, source);
    },
  });

  // Get skill tool
  tools["get_skill"] = tool({
    description: "Load a skill by ID",
    inputSchema: z.object({
      skillId: z.string().describe("The skill ID"),
    }),
    execute: async ({ skillId }) => {
      if (!resolvedExecutor) {
        return "Skill loading not available";
      }
      return resolvedExecutor.getSkill(skillId, workspaceId);
    },
  });

  return tools;
}

// Ask user tool
export function createAskUserTool() {
  return createTool({
    id: "ask_user",
    description:
      "Ask the user questions during execution. Use this to gather preferences or clarify instructions.",
    inputSchema: z.object({
      questions: z
        .array(
          z.object({
            question: z.string().describe("The question to ask"),
            options: z
              .array(
                z.object({
                  label: z.string().describe("Display text"),
                  description: z.string().optional(),
                }),
              )
              .optional(),
          }),
        )
        .min(1)
        .max(4),
    }),
    requireApproval: true,
    execute: async (inputData) => {
      return { questions: inputData.questions };
    },
  });
}

// Core agents - simplified
export async function createCoreAgents(
  modelConfig?: ModelConfig,
): Promise<{
  gatherContextAgent: Agent;
  takeActionAgent: Agent;
}> {
  const resolvedModel = modelConfig ?? (await getDefaultChatModelId());

  // Gather context agent
  const gatherContextAgent = new Agent({
    id: "gather-context",
    name: "Gather Context",
    instructions:
      "You are a context gathering assistant. Search the user's memory to find relevant information. Be thorough but concise.",
    model: resolvedModel as any,
  });

  // Take action agent
  const takeActionAgent = new Agent({
    id: "take-action",
    name: "Take Action",
    instructions:
      "You are an action-oriented assistant. Help the user accomplish their goals using available tools.",
    model: resolvedModel as any,
  });

  return {
    gatherContextAgent,
    takeActionAgent,
  };
}
