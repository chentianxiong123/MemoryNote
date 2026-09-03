import { z } from "zod";
import type { PrismaClient } from "@core/database";
import { UserTypeEnum } from "@core/types";

export const CreateConversationSchema = z.object({
  message: z.string(),
  title: z.string().optional(),
  conversationId: z.string().optional(),
  source: z.string().optional(),
  incognito: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
  userType: z.nativeEnum(UserTypeEnum).optional(),
  asyncJobId: z.string().optional(),
  modelId: z.string().optional(),
  panelMode: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
  parts: z
    .array(z.object({ text: z.string(), type: z.string() }))
    .optional(),
});

export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const GetConversationsListSchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("20"),
  search: z.string().optional(),
  source: z.string().optional(),
  unread: z.string().optional(),
  asyncJobId: z.string().optional(),
});

export type GetConversationsListDto = z.infer<typeof GetConversationsListSchema>;

export type TaskRun = {
  id: string;
  createdAt: Date;
  status: string;
  lastMessage: { text: string; userType: string } | null;
};

export type ConversationClient = Pick<PrismaClient, "conversation" | "conversationHistory">;

export async function createConversation(
  db: ConversationClient,
  data: CreateConversationDto,
) {
  const { title, conversationId, source, asyncJobId, incognito, ...rest } = data;

  if (conversationId) {
    const history = await db.conversationHistory.create({
      data: {
        ...rest,
        userType: rest.userType || UserTypeEnum.User,
        conversation: { connect: { id: conversationId } },
      },
      include: { conversation: true },
    });
    return {
      conversationId: history.conversation.id,
      conversationHistoryId: history.id,
    };
  }

  const conversation = await db.conversation.create({
    data: {
      source: source || "core",
      asyncJobId: asyncJobId || null,
      incognito: incognito ?? false,
      title: (title ?? data.message).substring(0, 100),
      ConversationHistory: {
        create: {
          userType: rest.userType || UserTypeEnum.User,
          ...rest,
        },
      },
    },
    include: { ConversationHistory: true },
  });

  const first = conversation.ConversationHistory[0];
  if (!first) {
    throw new Error("Created conversation has no history record");
  }
  return {
    conversationId: conversation.id,
    conversationHistoryId: first.id,
  };
}

export async function getConversation(
  db: ConversationClient,
  conversationId: string,
) {
  return db.conversation.findUnique({ where: { id: conversationId } });
}

export async function deleteConversation(db: ConversationClient, conversationId: string) {
  return db.conversation.update({
    where: { id: conversationId },
    data: { deleted: new Date().toISOString() },
  });
}

export async function updateConversationTitle(
  db: ConversationClient,
  conversationId: string,
  title: string,
) {
  return db.conversation.update({
    where: { id: conversationId },
    data: { title: title.substring(0, 200) },
  });
}

export async function deleteConversationsBySource(db: ConversationClient, source: string) {
  return db.conversation.updateMany({
    where: { source, deleted: null },
    data: { deleted: new Date().toISOString() },
  });
}

export async function readConversation(db: ConversationClient, conversationId: string) {
  return db.conversation.update({
    where: { id: conversationId },
    data: { unread: false },
  });
}

export async function readAllConversations(db: ConversationClient) {
  return db.conversation.updateMany({
    where: { unread: true, deleted: null },
    data: { unread: false },
  });
}

export async function updateConversationStatus(
  db: ConversationClient,
  conversationId: string,
  status: "pending" | "running" | "completed" | "failed" | "need_attention",
) {
  return db.conversation.update({
    where: { id: conversationId },
    data: { status },
  });
}

export async function setActiveStreamId(
  db: ConversationClient,
  conversationId: string,
  streamId: string,
): Promise<void> {
  await db.conversation.update({
    where: { id: conversationId },
    data: { activeStreamId: streamId },
  });
}

export async function clearActiveStreamId(
  db: ConversationClient,
  conversationId: string,
): Promise<void> {
  await db.conversation.update({
    where: { id: conversationId },
    data: { activeStreamId: null },
  });
}

export async function getConversationAndHistory(
  db: ConversationClient,
  conversationId: string,
) {
  const existing = await db.conversation.findFirst({
    where: { id: conversationId, deleted: null },
    include: { ConversationHistory: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing) return existing;

  return db.conversation.create({
    data: { source: "onboarding", title: "Onboarding" },
    include: { ConversationHistory: { orderBy: { createdAt: "asc" } } },
  });
}

export async function createEmptyConversation(
  db: ConversationClient,
  title: string,
  asyncJobId?: string,
) {
  return db.conversation.create({
    data: {
      source: "task",
      title: title.substring(0, 100),
      asyncJobId: asyncJobId ?? null,
    },
    include: { ConversationHistory: true },
  });
}

export async function upsertConversationHistory(
  db: ConversationClient,
  args: {
    id?: string;
    parts: unknown;
    conversationId: string;
    userType: UserTypeEnum;
    unread?: boolean;
    thoughts?: Record<string, unknown>;
  },
) {
  const { id, parts, conversationId, userType, unread = true, thoughts } = args;
  const partsJson = parts as Parameters<typeof db.conversationHistory.upsert>[0]["create"]["parts"];
  const thoughtsJson = thoughts as Parameters<typeof db.conversationHistory.upsert>[0]["create"]["thoughts"];
  if (id) {
    const result = await db.conversationHistory.upsert({
      where: { id },
      create: { id, conversationId, parts: partsJson, message: "", thoughts: thoughtsJson, userType },
      update: { conversationId, parts: partsJson, message: "", thoughts: thoughtsJson, userType },
    });
    await db.conversation.update({ where: { id: conversationId }, data: { unread } });
    return result;
  }
  const created = await db.conversationHistory.create({
    data: { conversationId, parts: partsJson, message: "", thoughts: thoughtsJson, userType },
  });
  await db.conversation.update({ where: { id: conversationId }, data: { unread } });
  return created;
}

export async function markToolCallApprovalRequested(
  db: ConversationClient,
  conversationId: string,
  toolCallId: string,
  approvalId: string,
): Promise<void> {
  const latest = await db.conversationHistory.findFirst({
    where: { conversationId, userType: UserTypeEnum.Agent },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return;

  const parts = (latest.parts as Array<Record<string, unknown>>) ?? [];
  let changed = false;
  const updatedParts = parts.map((part) => {
    if (part?.toolCallId === toolCallId) {
      changed = true;
      return { ...part, state: "approval-requested", approval: { id: approvalId } };
    }
    return part;
  });
  if (!changed) return;

  await db.conversationHistory.update({
    where: { id: latest.id },
    data: { parts: updatedParts as Parameters<typeof db.conversationHistory.update>[0]["data"]["parts"] },
  });
}

export async function getConversationSources(
  db: ConversationClient,
): Promise<{ source: string; count: number }[]> {
  const rows = await db.conversation.groupBy({
    by: ["source"],
    where: { deleted: null, NOT: { source: "task" } },
    _count: { source: true },
  });
  return rows.map((r) => ({ source: r.source, count: r._count.source }));
}

export async function getConversationsList(db: ConversationClient, params: GetConversationsListDto) {
  const page = parseInt(params.page, 10);
  const limit = parseInt(params.limit, 10);
  const skip = (page - 1) * limit;

  const where = {
    deleted: null,
    ...(params.source ? { source: params.source } : {}),
    ...(params.asyncJobId ? { asyncJobId: params.asyncJobId } : {}),
    ...(params.unread === "true" ? { unread: true } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" as const } },
            {
              ConversationHistory: {
                some: { message: { contains: params.search, mode: "insensitive" as const } },
              },
            },
          ],
        }
      : {}),
  };

  const [conversations, total] = await Promise.all([
    db.conversation.findMany({
      where,
      include: {
        ConversationHistory: { take: 1, orderBy: { createdAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    db.conversation.count({ where }),
  ]);

  return {
    conversations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
}

function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  for (const part of parts) {
    if (
      part &&
      typeof part === "object" &&
      (part as { type?: string }).type === "text" &&
      typeof (part as { text?: string }).text === "string"
    ) {
      return (part as { text: string }).text;
    }
  }
  return "";
}

export async function getTaskRuns(db: ConversationClient, taskId: string): Promise<TaskRun[]> {
  const conversations = await db.conversation.findMany({
    where: { asyncJobId: taskId, deleted: null },
    orderBy: { createdAt: "desc" },
    include: {
      ConversationHistory: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { parts: true, userType: true },
      },
    },
  });

  return conversations.map((c) => {
    const head = c.ConversationHistory[0];
    return {
      id: c.id,
      createdAt: c.createdAt,
      status: c.status,
      lastMessage: head
        ? { text: extractTextFromParts(head.parts), userType: head.userType }
        : null,
    };
  });
}
