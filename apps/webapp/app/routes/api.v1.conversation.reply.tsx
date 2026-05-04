import { json } from "@remix-run/node";
import { UserTypeEnum } from "@core/types";
import { z } from "zod";
import { type ModelMessage } from "ai";

import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import {
  getConversationAndHistory,
  updateConversationStatus,
  upsertConversationHistory,
} from "~/services/conversation.server";
import { saveConversationResult } from "~/services/agent/mastra-stream.server";
import { getCorePrompt } from "~/services/agent/prompts";
import { searchMemoryWithAgent } from "~/services/agent/memory";
import { getDefaultChatModelId } from "~/services/llm-provider.server";
import { logger } from "~/services/logger.service";
import { getUserById } from "~/models/user.server";
import { makeModelCall } from "~/lib/model.server";
import { generateKnowledgeCaptureBatch } from "~/services/knowledge-capture.server";

const ReplyConversationRequestSchema = z.object({
  id: z.string(),
  message: z.string().min(1),
  source: z.string().default("core"),
  modelId: z.string().optional(),
});

type TextPart = { type?: string; text?: string };

function getTextFromParts(parts: TextPart[] | null | undefined): string {
  return (parts ?? [])
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function buildConversationTranscript(
  history: Array<{
    userType: string;
    message: string;
    parts: unknown;
  }>,
): string {
  return history
    .slice(-12)
    .map((entry) => {
      const role = entry.userType === "Agent" ? "Assistant" : "User";
      const text =
        getTextFromParts((entry.parts as TextPart[] | null | undefined) ?? undefined) ||
        entry.message ||
        "";

      return `${role}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

function buildMemoryContext(results: any): string {
  if (!results || typeof results !== "object") return "";

  const episodes = Array.isArray(results.episodes)
    ? results.episodes
        .slice(0, 5)
        .map((episode: any) => episode.content || episode.text || episode.fact)
        .filter(Boolean)
    : [];

  const statements = Array.isArray(results.statements)
    ? results.statements
        .slice(0, 5)
        .map((statement: any) => statement.fact || statement.content)
        .filter(Boolean)
    : [];

  const invalidatedFacts = Array.isArray(results.invalidatedFacts)
    ? results.invalidatedFacts
        .slice(0, 3)
        .map((fact: any) => fact.fact || fact.content)
        .filter(Boolean)
    : [];

  const lines = [
    ...episodes.map((item: string) => `- ${item}`),
    ...statements.map((item: string) => `- ${item}`),
    ...invalidatedFacts.map((item: string) => `- Outdated: ${item}`),
  ];

  if (lines.length === 0) return "";

  return `Relevant memory context:\n${lines.join("\n")}`;
}

function toUserFacingReplyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    normalized.includes("connect timeout") ||
    normalized.includes("cannot connect to api") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network")
  ) {
    return "当前模型服务暂时不可达，消息已经保存。请先检查模型 API 地址、网络连通性，或切换到可访问的模型端点后再试。";
  }

  if (normalized.includes("api key") || normalized.includes("unauthorized")) {
    return "当前模型配置不可用，消息已经保存。请先检查 API Key 或工作区模型设置后再试。";
  }

  return "我这边在生成回复时出了点问题，不过你的消息已经保存。你可以再试一次。";
}

const { loader, action } = createHybridActionApiRoute(
  {
    body: ReplyConversationRequestSchema,
    allowJWT: true,
    authorization: {
      action: "conversation",
    },
    corsStrategy: "all",
  },
  async ({ body, authentication }) => {
    const workspaceId = authentication.workspaceId as string;
    const conversation = await getConversationAndHistory(
      body.id,
      authentication.userId,
    );

    if (!conversation) {
      return json({ error: "Conversation not found" }, { status: 404 });
    }

    const user = await getUserById(authentication.userId);
    const userMetadata = (user?.metadata ?? {}) as Record<string, unknown>;
    const timezone =
      typeof userMetadata.timezone === "string" ? userMetadata.timezone : "UTC";

    const lastHistory =
      conversation.ConversationHistory[
        conversation.ConversationHistory.length - 1
      ];
    const lastText =
      getTextFromParts(lastHistory?.parts as TextPart[] | null | undefined) ||
      lastHistory?.message ||
      "";
    const lastWasSameUserMessage =
      lastHistory?.userType === UserTypeEnum.User &&
      lastText.trim() === body.message.trim();

    if (!lastWasSameUserMessage) {
      await upsertConversationHistory(
        crypto.randomUUID(),
        [{ type: "text", text: body.message }],
        body.id,
        UserTypeEnum.User,
      );
    }

    const updatedConversation = await getConversationAndHistory(
      body.id,
      authentication.userId,
    );

    const memoryResults = await searchMemoryWithAgent(
      body.message,
      authentication.userId,
      workspaceId,
      body.source,
      { limit: 8 },
    ).catch(() => null);

    const memoryContext = buildMemoryContext(memoryResults);
    const transcript = buildConversationTranscript(
      updatedConversation?.ConversationHistory ?? [],
    );

    const systemPrompt = `${getCorePrompt(
      "web",
      {
        name: user?.displayName ?? user?.name ?? "User",
        email: user?.email ?? "",
        timezone,
        phoneNumber: user?.phoneNumber ?? undefined,
      },
      undefined,
      "MemoryNote",
    )}

You are operating in Vue migration mode.
- Reply directly and helpfully.
- Use the conversation transcript and memory context when relevant.
- If no memory context is available, answer from the conversation transcript and the latest request only.
- Match the user's language.
- Keep answers concise unless the user explicitly asks for depth.`;

    const promptSections = [
      memoryContext,
      transcript ? `Conversation transcript:\n${transcript}` : "",
      `Latest user request:\n${body.message}`,
    ].filter(Boolean);

    await updateConversationStatus(body.id, "running");

    const assistantId = crypto.randomUUID();
    let assistantText = "";
    let replyGenerated = false;
    const modelString = body.modelId ?? getDefaultChatModelId();
    const modelMessages: ModelMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: promptSections.join("\n\n") },
    ];

    try {
      await makeModelCall(
        false,
        modelMessages,
        (text) => {
          assistantText = text.trim();
        },
        { temperature: 0.4 },
        "medium",
        "vue-sync-reply",
        undefined,
        workspaceId,
        "chat",
      );

      if (!assistantText) {
        assistantText = "我已经处理了你的请求，但当前模型没有返回可展示的文本结果。";
      }

      replyGenerated = true;

      await saveConversationResult({
        id: assistantId,
        parts: [{ type: "text", text: assistantText }],
        conversationId: body.id,
        incomingUserText: body.message,
        incognito: conversation.incognito,
        userId: authentication.userId,
        workspaceId,
      });
    } catch (error) {
      logger.error("Vue sync reply failed", {
        conversationId: body.id,
        error: error instanceof Error ? error.message : String(error),
      });

      assistantText = toUserFacingReplyError(error);

      await saveConversationResult({
        id: assistantId,
        parts: [{ type: "text", text: assistantText }],
        conversationId: body.id,
        incomingUserText: body.message,
        incognito: conversation.incognito,
        userId: authentication.userId,
        workspaceId,
      });
    }

    const knowledgeCaptureBatch = replyGenerated
      ? await generateKnowledgeCaptureBatch({
          conversationId: body.id,
          sessionId: body.id,
          userId: authentication.userId,
          workspaceId,
          userName: user?.displayName ?? user?.name ?? null,
          userMessage: body.message,
          assistantMessage: assistantText,
        }).catch(() => null)
      : null;

    const refreshedConversation = await getConversationAndHistory(
      body.id,
      authentication.userId,
    );

    return json({
      assistantMessage: {
        id: assistantId,
        role: "assistant",
        text: assistantText,
        parts: [{ type: "text", text: assistantText }],
      },
      knowledgeCaptureBatch: knowledgeCaptureBatch
        ? {
            id: knowledgeCaptureBatch.id,
            summary: knowledgeCaptureBatch.summary,
            createdAt: knowledgeCaptureBatch.createdAt.toISOString(),
            itemCount: knowledgeCaptureBatch.items.length,
            proposedCount: knowledgeCaptureBatch.items.filter(
              (item) => item.status === "PROPOSED",
            ).length,
          }
        : null,
      conversation: refreshedConversation
        ? {
            id: refreshedConversation.id,
            title: refreshedConversation.title,
            incognito: refreshedConversation.incognito,
            ConversationHistory: (refreshedConversation.ConversationHistory ?? []).map(
              (history) => ({
                id: history.id,
                role:
                  (history as any).role ??
                  (history.userType === "Agent" ? "assistant" : "user"),
                parts: history.parts ?? [{ type: "text", text: history.message }],
                createdAt: history.createdAt,
              }),
            ),
          }
        : null,
    });
  },
);

export { loader, action };
