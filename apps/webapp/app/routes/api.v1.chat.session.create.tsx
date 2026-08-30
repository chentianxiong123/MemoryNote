import { json } from "~/lib/remix-compat";
import { z } from "zod";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { prisma } from "~/db.server";

// 创建新会话
const CreateChatSessionSchema = z.object({
  title: z.string().optional(),
});

const { action } = createHybridActionApiRoute({
  body: CreateChatSessionSchema,
  allowJWT: false,
  corsStrategy: "all",
}, async ({ body }) => {
  const conversation = await prisma.conversation.create({
    data: {
      source: "simple-chat",
      title: body.title || "新对话",
    },
    include: {
      ConversationHistory: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return json({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.ConversationHistory.map((h) => ({
      id: h.id,
      role: h.userType === "User" ? "user" : "assistant",
      content: h.parts?.find((p: any) => p.type === "text")?.text || "",
      createdAt: h.createdAt.toISOString(),
    })),
  });
});

export { action };
