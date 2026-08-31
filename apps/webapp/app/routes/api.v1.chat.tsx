import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";
import { getLLMConfig } from "~/services/llm-config.server";

// 简单聊天请求 schema
const ChatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, "消息不能为空"),
});

async function callLLM(message: string): Promise<string> {
  const cfg = getLLMConfig();
  const apiKey = cfg.openaiApiKey;
  const baseUrl = cfg.openaiBaseUrl ?? "https://api.openai.com/v1";
  const model = cfg.chatModel;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你是 MemoryNote 个人知识助手，简洁友好地回复用户。",
        },
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "(空回复)";
}

const { action } = createHybridActionApiRoute({
  body: ChatRequestSchema,
  allowJWT: false,
  corsStrategy: "all",
}, async ({ body }) => {
  const { conversationId, message } = body;

  // 获取或创建会话
  let cid = conversationId;
  if (!cid) {
    const conv = await prisma.conversation.create({
      data: {
        source: "simple-chat",
        title: message.slice(0, 50),
      },
    });
    cid = conv.id;
  }

  // 保存用户消息
  await prisma.conversationHistory.create({
    data: {
      conversationId: cid,
      userType: "User",
      message,
      parts: [{ type: "text", text: message }] as any,
    },
  });

  // 调真实 LLM
  let reply: string;
  try {
    reply = await callLLM(message);
  } catch (err) {
    reply = `⚠️ LLM 调用失败: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 保存助手回复
  const history = await prisma.conversationHistory.create({
    data: {
      conversationId: cid,
      userType: "Agent",
      message: reply,
      parts: [{ type: "text", text: reply }] as any,
    },
  });

  return json({
    id: history.id,
    conversationId: cid,
    role: "assistant",
    content: reply,
    createdAt: history.createdAt.toISOString(),
  });
});

export { action };
