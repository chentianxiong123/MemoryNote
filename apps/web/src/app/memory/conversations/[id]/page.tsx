import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ChatPanel } from "@/components/ChatPanel";
import * as core from "@core/core";

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
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px" }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/memory/documents" style={{ color: "var(--muted)" }}>← 返回列表</Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>
          {conversation.title ?? "(无标题)"}
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 4, fontSize: 12 }}>
          source: {conversation.source} · 消息 {messages.length} 条 · 状态 {conversation.status}
        </p>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {messages.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>暂无消息</p>
        ) : (
          messages.map((m) => {
            const isUser = m.userType === "User";
            return (
              <div
                key={m.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: isUser ? "#0f1a2e" : "#111",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  {m.userType} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.message || <em style={{ color: "var(--muted)" }}>(空)</em>}
                </div>
              </div>
            );
          })
        )}
      </section>

      {hasApiKey ? (
        <section style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>继续对话</h2>
          <div style={{ height: 360 }}>
            <ChatPanel conversationId={conversation.id} />
          </div>
        </section>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 12 }}>
          未配置 OPENAI_API_KEY,无法继续对话
        </p>
      )}
    </main>
  );
}
