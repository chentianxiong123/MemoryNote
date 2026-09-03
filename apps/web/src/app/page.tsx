import Link from "next/link";
import { prisma } from "@/lib/db";
import * as core from "@core/core";

export const dynamic = "force-dynamic";

async function getStats() {
  const [conversations, convTotal, docTotal, inboxStats, batches, tags] = await Promise.all([
    prisma.conversation.findMany({
      where: { deleted: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, source: true, updatedAt: true, unread: true },
    }),
    prisma.conversation.count({ where: { deleted: null } }),
    prisma.document.count({ where: { deleted: null } }),
    core.knowledge.getInboxStats(prisma),
    core.knowledge.listInboxBatches(prisma, 5),
    core.search.getTagCloud(prisma, { minDocs: 2, limit: 20 }),
  ]);

  const filteredTags = core.search.filterDefaultValues(tags);

  return {
    recentConversations: conversations.map((c) => ({
      id: c.id,
      title: c.title ?? "(无标题)",
      source: c.source,
      updatedAt: c.updatedAt,
      unread: c.unread,
    })),
    totals: {
      conversations: convTotal,
      documents: docTotal,
      combined: convTotal + docTotal,
    },
    inbox: inboxStats,
    batches: batches.length,
    topTags: filteredTags.slice(0, 10).map((t) => ({ word: t.word, count: t.doc_count })),
  };
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px" }}>
      <header style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>MemoryNote</h1>
          <p style={{ color: "var(--muted)", marginTop: 4 }}>
            v2 · Next.js 15 · 单一前端
          </p>
        </div>
        <nav style={{ display: "flex", gap: 12, fontSize: 13 }}>
          <Link href="/memory/documents">记忆文档</Link>
          <Link href="/chat/new">新对话</Link>
        </nav>
      </header>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>总数</h2>
        <div style={{ display: "flex", gap: 16 }}>
          <Card label="对话" value={stats.totals.conversations} />
          <Card label="文档" value={stats.totals.documents} />
          <Card label="合计" value={stats.totals.combined} accent />
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>收件箱</h2>
        <div style={{ display: "flex", gap: 16 }}>
          <Card label="待处理" value={stats.inbox.proposedCount} />
          <Card label="已暂缓" value={stats.inbox.snoozedCount} />
          <Card label="批次数" value={stats.inbox.batchCount} />
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>最近对话</h2>
        <ul style={{ listStyle: "none" }}>
          {stats.recentConversations.map((c) => (
            <li
              key={c.id}
              style={{
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{c.title}</span>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                {c.source} · {c.updatedAt.toISOString().slice(0, 10)}
                {c.unread && " · ●"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Top 10 关键词</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {stats.topTags.map((t) => (
            <span
              key={t.word}
              style={{
                padding: "4px 10px",
                background: "#1a1a1a",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
              }}
            >
              {t.word} <span style={{ color: "var(--muted)" }}>({t.count})</span>
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

function Card({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        padding: 16,
        background: accent ? "#0f1a2e" : "#111",
        border: "1px solid var(--border)",
        borderRadius: 6,
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: accent ? "var(--accent)" : "var(--fg)" }}>
        {value}
      </div>
    </div>
  );
}
