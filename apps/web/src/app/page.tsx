import Link from "next/link";
import { prisma } from "@/lib/db";
import * as core from "@core/core";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

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
    <AppShell>
      <div className="shell__meta">
        <span className="chip chip--accent">对话 {stats.totals.conversations}</span>
        <span className="chip">文档 {stats.totals.documents}</span>
        <span className="chip chip--accent">合计 {stats.totals.combined}</span>
      </div>

      <div className="meta-grid">
        <div className="meta-card">
          <span className="meta-card__label">对话总数</span>
          <strong>{stats.totals.conversations}</strong>
        </div>
        <div className="meta-card">
          <span className="meta-card__label">文档总数</span>
          <strong>{stats.totals.documents}</strong>
        </div>
        <div className="meta-card">
          <span className="meta-card__label">收件箱待处理</span>
          <strong>{stats.inbox.proposedCount}</strong>
        </div>
        <div className="meta-card">
          <span className="meta-card__label">收件箱已暂缓</span>
          <strong>{stats.inbox.snoozedCount}</strong>
        </div>
      </div>

      <SectionCard title="最近对话" eyebrow="会话历史">
        {stats.recentConversations.length === 0 ? (
          <p className="empty-state">暂无对话</p>
        ) : (
          <div className="conversation-list">
            {stats.recentConversations.map((c) => (
              <Link
                key={c.id}
                href={`/memory/conversations/${c.id}`}
                className="conversation-list__item"
              >
                <div className="conversation-list__meta">
                  <span>{c.title}</span>
                  <small>{c.updatedAt.toISOString().slice(0, 10)} · {c.source}</small>
                </div>
                {c.unread && <span style={{ color: "var(--accent)" }}>●</span>}
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="关键词" eyebrow="热门标签">
        <div className="tag-cloud">
          {stats.topTags.map((t) => (
            <span key={t.word} className="tag-cloud__tag">
              {t.word}
              <small>{t.count}</small>
            </span>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
