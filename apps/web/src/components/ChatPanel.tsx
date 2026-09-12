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
    <div className="composer" style={{ height: "100%" }}>
      <div
        className="thread"
        style={{
          flex: 1,
          overflowY: "auto",
          background: "var(--bg-panel)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          padding: "16px",
          minHeight: 240,
        }}
      >
        {messages.length === 0 && (
          <div className="empty-state">发消息开始对话</div>
        )}
        {messages.map((m) => {
          const text = m.parts
            ?.filter((p) => p.type === "text")
            .map((p) => (p as { type: "text"; text: string }).text)
            .join("") ?? "";
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`thread__bubble ${isUser ? "thread__bubble--user" : "thread__bubble--assistant"}`}
              style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "80%" }}
            >
              <div className="thread__role">{isUser ? "我" : "AI"}</div>
              <div className="thread__text">{text || <em>(空)</em>}</div>
            </div>
          );
        })}
        {isStreaming && (
          <div className="status">● 正在输入</div>
        )}
      </div>

      {error && (
        <div className="status status--error" style={{ padding: 8, borderRadius: 8, background: "rgba(162,43,43,0.1)" }}>
          错误: {error.message}
        </div>
      )}

      <form onSubmit={submit} className="composer__actions">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="输入消息..."
          className="input"
          style={{ flex: 1 }}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={() => stop()}
            className="button button--ghost"
          >
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={!isReady || !draft.trim()}
            className="button"
          >
            发送
          </button>
        )}
      </form>
    </div>
  );
}
