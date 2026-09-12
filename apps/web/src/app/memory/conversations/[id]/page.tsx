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

export default async function ConversationPage({ params }: PageProps) {
  const { id } = await params;

  const conversation = await core.conversation.getConversationAndHistory(prisma, id);
  if (!conversation) notFound();

  await core.conversation.readConversation(prisma, conversation.id);

  const messages = conversation.ConversationHistory;
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  return (
    <AppShell>
      <SectionCard title={conversation.title ?? "(无标题)"} eyebrow={conversation.source}>
        <p className="status">
          消息 {messages.length} 条 · 状态 {conversation.status}
        </p>

        <div className="thread">
          {messages.length === 0 ? (
            <p className="empty-state">暂无消息</p>
          ) : (
            messages.map((m) => {
              const isUser = m.userType === "User";
              return (
                <div
                  key={m.id}
                  className={`thread__bubble ${isUser ? "thread__bubble--user" : "thread__bubble--assistant"}`}
                >
                  <div className="thread__role">
                    {isUser ? "我" : "AI"}
                  </div>
                  <div className="thread__text">{m.message || "(空)"}</div>
                  <div className="thread__time">
                    {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {hasApiKey && (
          <div className="composer" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 8px" }}>继续对话</h2>
            <div style={{ height: 360 }}>
              <ChatPanel conversationId={conversation.id} />
            </div>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
