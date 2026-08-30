import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";

// 简单聊天请求 schema
const ChatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, "消息不能为空"),
});

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
      parts: [{ type: "text", text: message }] as any,
    },
  });

  // 模拟回复
  const replies = [
    "这是一个简单的聊天示例。你的消息已收到！",
    "理解你的想法了。请告诉我更多细节。",
    "好的，我收到了你的消息。想聊点什么？",
    "有意思的观点！继续说说你的想法。",
    "已收到！这是一个简单的聊天演示。",
  ];
  const reply = replies[Math.floor(Math.random() * replies.length)];

  // 保存助手回复
  const history = await prisma.conversationHistory.create({
    data: {
      conversationId: cid,
      userType: "Agent",
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
