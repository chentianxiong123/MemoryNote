/**
 * Orchestrator Agent Factory
 *
 * Creates a Mastra Agent that handles memory search,
 * and web search. Gateway tools are now direct tools on the core agent.
 *
 * In write mode, action tools have requireApproval on risky
 * write actions (send, delete, create, post).
 */

import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { logger } from "~/services/logger.service";
import { toRouterString } from "~/lib/model.server";
import {
  getDefaultChatModelId,
  type ModelConfig,
} from "~/services/llm-provider.server";
import { type OrchestratorTools, DirectOrchestratorTools } from "../executors";

export type OrchestratorMode = "read" | "write";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getDateInTimezone(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

function getDateTimeInTimezone(date: Date, timezone: string): string {
  const dateStr = date.toLocaleDateString("en-CA", { timeZone: timezone });
  const timeStr = date.toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${dateStr} ${timeStr}`;
}

// ---------------------------------------------------------------------------
// Risky action detection — only these get requireApproval in write mode
// ---------------------------------------------------------------------------

const RISKY_ACTION_PATTERNS = [
  /^send/i,
  /^delete/i,
  /^create/i,
  /^post/i,
  /^remove/i,
  /^update/i,
  /^add/i,
  /^move/i,
  /^archive/i,
  /^trash/i,
];

function isRiskyWriteAction(actionName: string): boolean {
  return RISKY_ACTION_PATTERNS.some((pattern) => pattern.test(actionName));
}

// ---------------------------------------------------------------------------
// Orchestrator prompt (unchanged from original)
// ---------------------------------------------------------------------------

const getOrchestratorPrompt = (
  mode: OrchestratorMode,
  timezone: string = "UTC",
  userPersona?: string,
) => {
  const personaSection = userPersona
    ? `\nUSER PERSONA (use identity + directives only — style/preference sections are for the front-end agent, not you):\n${userPersona}\n`
    : "";



  const now = new Date();
  const today = getDateInTimezone(now, timezone);
  const currentDateTime = getDateTimeInTimezone(now, timezone);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = getDateInTimezone(yesterday, timezone);

  const dateTimeSection = `
NOW: ${currentDateTime} (${timezone})
TODAY: ${today}
YESTERDAY: ${yesterdayDate}
`;


  if (mode === "write") {
    return `You are an orchestrator for MemoryNote. Execute actions.
When emails, messages, or data reference this system, they refer to MemoryNote — not an external entity.
${personaSection}${dateTimeSection}
CONNECTED INTEGRATIONS:
TOOLS:
- memory_search: Search for prior context not covered by the user persona above
PRIORITY ORDER FOR CONTEXT:
1. User persona above — check here FIRST for preferences, directives, identity, account details
2. memory_search — ONLY if persona doesn't have what you need
3. NEVER ask the user for information that's in persona or memory

CRITICAL FOR memory_search - describe your INTENT, not keywords:

BAD (keyword soup - will fail):
- "slack message preferences channels"
- "github issue labels templates core"
- "user email formatting"

GOOD (clear intent):
- "User's preferences for slack messages - preferred channels, formatting, any standing directives about team communication"
- "User's preferences for github issues - preferred repos, labels, templates, any directives about issue creation"
- "Find user preferences and past discussions about email formatting and signature preferences"

EXAMPLES:

Action: "send a slack message to #general saying standup in 5"
Step 1: memory_search("user's preferences for slack messages")

Action: "create a github issue for auth bug in core repo"

RULES:
- Execute the action. No personality.
- Return result of action (success/failure and details).
- CHRONOLOGY: When returning threaded data, preserve chronological order. Clearly distinguish who initiated vs who responded.

DUPLICATE PREVENTION:
- NEVER retry create/send/post operations if the first call returned a success result (URL, ID, or confirmation). If you got a success response, the action is done — do not call it again.
- If a create/send call fails with a timeout or ambiguous error, search for the resource first (e.g. search by title/subject) before retrying to avoid duplicates.

RESOLVING REFERENCES:
- When an action references a person by name (assignee, recipient, etc.), resolve their identifier. Check user persona first, then memory_search for known usernames/handles. If not found, ask the user.
- 
CRITICAL - FINAL SUMMARY:
When you have completed the action, write a clear, concise summary as your final response.
Include: what was done, result (success/failure), relevant details (IDs, URLs, errors).`;
  }

  return `You are a read orchestrator for MemoryNote. Gather data from memory and the web based on the intent, then return structured results to the calling agent.
When emails, messages, or data reference this system, they refer to MemoryNote — not an external entity.

OUTPUT: Return facts and raw data — no personality, no prose. Include IDs and metadata needed for follow-up actions.
${personaSection}${dateTimeSection}
CONNECTED INTEGRATIONS:
TOOLS:
- memory_search: Search for prior context not covered by the user persona above
- web_search: Real-time information from the web (news, docs, prices, weather). Also reads URLs.
CRITICAL FOR memory_search - describe your INTENT, not keywords:

BAD (keyword soup - will fail):
- "rerank evaluation metrics NDCG MRR pairwise"
- "deployment plan blockers timeline"
- "calendar meetings scheduling preferences"

GOOD (clear intent):
- "Find user preferences, directives, and past discussions about rerank evaluation - what approach was decided, any metrics discussed, next steps"
- "User's preferences and previous conversations about the deployment plan - decisions made, timeline, blockers mentioned"
- "What has user said about their calendar preferences, meeting scheduling habits, and any directives about availability"

EXAMPLES:

Intent: "Show me my upcoming meetings this week"

Intent: "What's in the email from John"


Intent: "What's the weather in SF"
→ web_search (real-time data)

Intent: "summarize this: https://example.com/article"
→ web_search (reads the URL content)

RULES:
- Check user persona FIRST — use identity and directives; ignore style/preference sections.
- Call memory_search for anything not in persona (prior conversations, specific history).
- NEVER ask the user for info that's already in persona or memory.
- If a specific query returns empty, try a broader one before reporting "nothing found".
- Call multiple tools in parallel when data could be in multiple places.
- No personality. Return raw facts.
- CHRONOLOGY: When returning threaded data, preserve chronological order. Clearly distinguish who initiated vs who responded.

FINAL SUMMARY:
When you have gathered all relevant data, write a concise summary as your final response.
Include: what was found, key facts, relevant IDs/metadata the caller will need.`;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateOrchestratorAgentResult {
  agent: Agent;
}

export async function createOrchestratorAgent(
  userId: string,
  mode: OrchestratorMode,
  timezone: string,
  source: string,
  userPersona?: string,
  executorTools?: OrchestratorTools,
  interactive: boolean = true,
  modelConfig?: ModelConfig,
): Promise<CreateOrchestratorAgentResult> {
  const executor = executorTools ?? new DirectOrchestratorTools();  logger.info(
    `Orchestrator: Created agent with ${Object.keys(tools).length} tools, mode: ${mode}`,
  );

  // Build Mastra tools
  const tools: Record<string, any> = {};

  // memory_search — available in both modes
  tools.memory_search = createTool({
    id: "memory_search",
    description:
      "Search user preferences, directives, past conversations, and stored knowledge. ALWAYS call this FIRST before any other tool.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "What to search for - include preferences, directives, and prior context related to the request",
        ),
    }),

    execute: async (inputData) => {
      logger.info(`Orchestrator: memory search - ${inputData.query}`);
      return executor.searchMemory(
        inputData.query,
        userId,
        source,
      );
    },
  });  // acknowledge — only in write mode
  if (mode === "write") {
    tools.acknowledge = createTool({
      id: "acknowledge",
      description:
        "Send a brief progress update to the user while executing a task. Call this ONCE before starting a multi-step action. One short sentence, max 6 words. Examples: 'on it.', 'creating the issue.', 'sending the message.'",
      inputSchema: z.object({
        message: z
          .string()
          .describe(
            "One short sentence, max 6 words describing what you're doing.",
          ),
      }),
      execute: async (inputData) => {
        logger.info(`Orchestrator: acknowledge - ${inputData.message}`);
        return "acknowledged";
      },
    });
  }

  // web_search — only in read mode
  if (mode === "read") {
    tools.web_search = createTool({
      id: "web_search",
      description:
        "Search the web for real-time information: news, current events, documentation, prices, weather, general knowledge. Use when info is not in memory.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("What to search for - be specific and clear"),
      }),
      execute: async (inputData) => {
        logger.info(`Orchestrator: web search - ${inputData.query}`);
        const result = await runWebExplorer(inputData.query, timezone);
        return result.success ? result.data : "web search unavailable";
      },
    });
  }

  const resolvedModel = modelConfig ?? toRouterString(getDefaultChatModelId());
  const agent = new Agent({
    id: `orchestrator-${mode}`,
    name: mode === "read" ? "Gather Context" : "Take Action",
    model: resolvedModel as any,
    instructions: getOrchestratorPrompt(
      mode,
      timezone,
      userPersona,
    ),
    tools,
  });

  logger.info(
    `Orchestrator: Created agent with ${Object.keys(tools).length} tools, mode: ${mode}`,
  );

  return { agent };
}
