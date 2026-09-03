import { streamText, type UIMessage } from "ai";
import { z } from "zod";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { prisma } from "@/lib/db";
import * as core from "@core/core";
import { UserTypeEnum } from "@core/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ChatInputSchema = z.object({
  conversationId: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    }),
  ),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = ChatInputSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { conversationId, messages } = parsed.data;
  const lastUser = messages.findLast((m) => m.role === "user");
  if (!lastUser) {
    return new Response(JSON.stringify({ error: "no user message" }), { status: 400 });
  }

  let targetConvId: string | null = null;

  if (conversationId) {
    const conv = await core.conversation.getConversation(prisma, conversationId);
    if (conv) {
      targetConvId = conv.id;
      await prisma.conversationHistory.create({
        data: {
          conversationId: conv.id,
          message: lastUser.content,
          userType: UserTypeEnum.User,
        },
      });
    }
  }

  if (!targetConvId) {
    const created = await core.conversation.createConversation(prisma, {
      message: lastUser.content,
      source: "core",
    });
    targetConvId = created.conversationId;
    if (!targetConvId) {
      return new Response(JSON.stringify({ error: "create failed" }), { status: 500 });
    }
  }

  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), { status: 500 });
  }

  const modelName = process.env.MODEL || "gpt-4o-mini";
  const provider = createOpenAICompatible({ name: "core", baseURL, apiKey });
  const model = provider(modelName);

  const result = streamText({
    model,
    system: "你是 MemoryNote 的助手。请用简洁的中文回答。",
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    onFinish: async ({ text }) => {
      if (!targetConvId || !text) return;
      try {
        await prisma.conversationHistory.create({
          data: {
            conversationId: targetConvId,
            message: text,
            userType: UserTypeEnum.Agent,
          },
        });
      } catch (e) {
        console.error("onFinish persist failed:", e);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

export type { UIMessage };
