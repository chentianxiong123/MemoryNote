import Link from "next/link";
import { ChatPanel } from "@/components/ChatPanel";

export default function NewChatPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px", height: "calc(100vh - 48px)" }}>
      <header style={{ marginBottom: 16 }}>
        <Link href="/memory/documents" style={{ color: "var(--muted)" }}>← 返回列表</Link>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>新对话</h1>
      </header>
      <div style={{ height: "calc(100% - 80px)" }}>
        <ChatPanel />
      </div>
    </main>
  );
}
