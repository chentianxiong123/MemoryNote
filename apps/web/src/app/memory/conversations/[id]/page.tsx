import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ChatPanel } from "@/components/ChatPanel";
import * as core from "@core/core";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(value?: Date) {
  if (!value) return "刚刚";
  return value.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ConversationPage({ params }: PageProps) {
  const { id } = await params;

  const existing = await prisma.conversation.findFirst({
    where: { id, deleted: null },
    select: { id: true },
  });
  if (!existing) notFound();

  const conversation = await core.conversation.getConversationAndHistory(prisma, id);
  if (!conversation) notFound();

  await core.conversation.readConversation(prisma, conversation.id);

  const messages = conversation.ConversationHistory;
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  return (
    <AppShell>
      <SectionCard title={conversation.title ?? "(无标题)"} eyebrow={`source: ${conversation.source}`}>
        <p className="conversation-note">
          对话是主工作区。如果这里提示模型不可达，优先去「模型设置」检查提供商地址和 Key。
          每轮回复结束后，系统会把可沉淀的知识整理成一组候选项，放到知识工作台里等待你确认。
        </p>

        {!hasApiKey && (
          <div className="conversation-warning">
            <strong>模型配置未完成</strong>
            <p>当前还没有配置可用的模型 Key，对话回复现在不会成功。请先配置 OPENAI_API_KEY。</p>
          </div>
        )}

        <div className="thread">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>先发一条消息，从对话开始积累你的个人知识。</p>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.userType === "User";
              return (
                <article
                  key={m.id}
                  className={`thread__bubble ${isUser ? "thread__bubble--user" : "thread__bubble--assistant"}`}
                >
                  <p className="thread__role">{isUser ? "你" : "MemoryNote"}</p>
                  <p className="thread__text">{m.message || "暂不支持展示该内容块。"}</p>
                  <small className="thread__time">{formatDateTime(m.createdAt)}</small>
                </article>
              );
            })
          )}
        </div>

        {hasApiKey && (
          <div className="composer" style={{ marginTop: 16 }}>
            <div className="composer__actions">
              <span className="status" style={{ fontSize: "0.85rem" }}>
                消息 {messages.length} 条 · 状态 {conversation.status}
              </span>
            </div>
            <div style={{ height: 300 }}>
              <ChatPanel conversationId={conversation.id} />
            </div>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
