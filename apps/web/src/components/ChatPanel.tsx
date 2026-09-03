"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export function ChatPanel({ conversationId }: { conversationId?: string }) {
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: uiMessages }) => {
        const body: Record<string, unknown> = {
          messages: uiMessages.map((m) => ({
            role: m.role,
            content:
              m.parts
                ?.filter((p) => p.type === "text")
                .map((p) => (p as { type: "text"; text: string }).text)
                .join("") ?? "",
          })),
        };
        if (conversationId) body.conversationId = conversationId;
        return { body };
      },
    }),
  });

  const [draft, setDraft] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || status !== "ready") return;
    setDraft("");
    sendMessage({ text });
  };

  const isReady = status === "ready";
  const isStreaming = status === "submitted" || status === "streaming";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 8,
          background: "#0a0a0a",
          border: "1px solid var(--border)",
          borderRadius: 4,
          minHeight: 240,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "var(--muted)", padding: 16, textAlign: "center" }}>
            发消息开始对话
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts
            ?.filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("") ?? "";
          return (
            <div
              key={m.id}
              style={{
                padding: "8px 12px",
                borderRadius: 4,
                background: m.role === "user" ? "#0f1a2e" : "#111",
                border: "1px solid var(--border)",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>
                {m.role === "user" ? "我" : "AI"}
              </div>
              {text || <em style={{ color: "var(--muted)" }}>(空)</em>}
            </div>
          );
        })}
        {isStreaming && (
          <div style={{ color: "var(--muted)", fontSize: 12, padding: 4 }}>● 正在输入</div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: 8,
            background: "#2e0f0f",
            border: "1px solid #5a2222",
            borderRadius: 4,
            fontSize: 12,
            color: "#d07f7f",
          }}
        >
          错误: {error.message}
        </div>
      )}

      <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="输入消息…"
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "#111",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 13,
          }}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={() => stop()}
            style={{
              padding: "8px 16px",
              background: "#5a2222",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={!isReady || !draft.trim()}
            style={{
              padding: "8px 16px",
              background: "var(--accent)",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              fontSize: 13,
              cursor: isReady ? "pointer" : "not-allowed",
              opacity: isReady ? 1 : 0.5,
            }}
          >
            发送
          </button>
        )}
      </form>
    </div>
  );
}
