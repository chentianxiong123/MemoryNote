/**
 * Simplified agent context builder for personal use.
 */

import { type Tool } from "ai";
import { type Agent } from "@mastra/core/agent";

import { getUserById } from "~/models/user.server";
import { getCorePrompt } from "~/services/agent/prompts";
import { createCoreTools, createCoreAgents } from "~/services/agent/agents/core";
import { type OrchestratorTools } from "~/services/agent/executors/base";
import { prisma } from "~/db.server";
import { type ModelConfig } from "~/services/llm-provider.server";
import { DirectOrchestratorTools } from "./executors";
import { type MessageEntry } from "./context-window";

interface BuildAgentContextParams {
  userId: string;
  workspaceId: string;
  source: string;
  finalMessages: any[];
  conversationId: string;
  executorTools?: OrchestratorTools;
  interactive?: boolean;
  modelConfig?: ModelConfig;
  triggerContext?: unknown;
  onMessage?: (message: string) => Promise<void>;
  channelMetadata?: Record<string, string>;
  scratchpadPageId?: string;
}

interface AgentContext {
  systemPrompt: string;
  tools: Record<string, Tool>;
  modelMessages: MessageEntry[];
  user: Awaited<ReturnType<typeof getUserById>>;
  timezone: string;
  gatherContextAgent: Agent;
  takeActionAgent: Agent;
  isBackgroundExecution: boolean;
  gatewayAgents: Agent[];
  thinkAgent?: Agent;
}

export async function buildAgentContext({
  userId,
  workspaceId,
  source,
  finalMessages,
  conversationId,
  executorTools,
  interactive = true,
  modelConfig,
}: BuildAgentContextParams): Promise<AgentContext> {
  // Load user
  const [user, workspace] = await Promise.all([
    getUserById(userId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, metadata: true },
    }),
  ]);

  if (!user) throw new Error("User not found");

  const userMetadata = (user.metadata ?? {}) as Record<string, unknown>;
  const timezone =
    typeof userMetadata.timezone === "string" ? userMetadata.timezone : "UTC";
  const metadata = (workspace?.metadata ?? {}) as Record<string, unknown>;
  const channel = source as import("./prompts/channel-formats").ChannelType;

  // Get core system prompt
  let systemPrompt = getCorePrompt(
    channel,
    {
      name: user.displayName ?? user.name ?? "User",
      email: user.email,
      timezone,
      phoneNumber: user.phoneNumber ?? undefined,
    },
    undefined,
    workspace?.name ?? undefined,
  );

  // Add current datetime
  const now = new Date();
  systemPrompt += `
    <current_datetime>
    Current date and time: ${now.toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    })}
    </current_datetime>`;

  // Create executor
  const executor = executorTools ?? new DirectOrchestratorTools();

  // Get available skills
  const skills = await prisma.document.findMany({
    where: { workspaceId, type: "skill", deleted: null },
    select: { id: true, title: true, metadata: true },
    orderBy: { createdAt: "desc" },
  });

  // Add skills context
  if (skills.length > 0) {
    const skillsList = skills
      .map((s) => `- "${s.title}" (ID: ${s.id})`)
      .join("\n");
    systemPrompt += `
    <skills>
    Available skills you can call with get_skill(skillId):
    ${skillsList}
    </skills>`;
  }

  // Create Mastra agents
  const { gatherContextAgent, takeActionAgent } =
    await createCoreAgents(modelConfig);

  const modelMessages = finalMessages as MessageEntry[];

  // Create tools
  const tools = await createCoreTools({
    executorTools: executor,
    workspaceId,
    userId,
    source,
    conversationId,
    interactive,
  });

  return {
    systemPrompt,
    tools,
    modelMessages,
    user,
    timezone,
    gatherContextAgent,
    takeActionAgent,
    isBackgroundExecution: !interactive,
    gatewayAgents: [],
  };
}
