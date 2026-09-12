import Link from "next/link";
import { prisma } from "@/lib/db";
import * as core from "@core/core";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

function formatDateTime(value?: Date | string | null) {
  if (!value) return "刚刚";
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

async function getStats() {
  const [conversations, convTotal, docTotal, inboxStats, tags] = await Promise.all([
    prisma.conversation.findMany({
      where: { deleted: null },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, source: true, updatedAt: true, unread: true },
    }),
    prisma.conversation.count({ where: { deleted: null } }),
    prisma.document.count({ where: { deleted: null } }),
    core.knowledge.getInboxStats(prisma),
    core.search.getTagCloud(prisma, { minDocs: 2, limit: 80 }),
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
    convTotal,
    docTotal,
    inbox: inboxStats,
    topTags: filteredTags.slice(0, 15).map((t) => ({ word: t.word, count: t.doc_count })),
  };
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <AppShell>
    <div className="home-dashboard">
      <header className="home-dashboard__welcome">
        <div>
          <p className="home-dashboard__eyebrow">个人知识沉淀系统</p>
          <h1>欢迎回来 👋</h1>
          <p className="home-dashboard__subtitle">这是你的第二大脑，记录着你的思考与成长</p>
        </div>
        <div className="home-dashboard__quick-actions">
          <Link className="button button--primary" href="/chat/new">
            💬 开始对话
          </Link>
          <Link className="button" href="/memory/documents">
            📥 处理收件箱
          </Link>
        </div>
      </header>

      <section className="home-dashboard__stats">
        <article className="stat-card">
          <div className="stat-card__icon">📊</div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.convTotal}</span>
            <span className="stat-card__label">对话总数</span>
          </div>
        </article>
        <article className="stat-card stat-card--accent">
          <div className="stat-card__icon">📄</div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.docTotal}</span>
            <span className="stat-card__label">文档总数</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card__icon">📥</div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.inbox.proposedCount}</span>
            <span className="stat-card__label">待确认项</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card__icon">🏷️</div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.topTags.length}</span>
            <span className="stat-card__label">活跃标签</span>
          </div>
        </article>
      </section>

      <section className="home-dashboard__overview">
        <div className="overview-grid">
          <article className="panel-card">
            <div className="panel-card__head">
              <p className="panel-card__eyebrow">最近对话</p>
              <Link className="panel-card__link" href="/memory/documents">查看全部</Link>
            </div>
            <div className="story-list">
              {stats.recentConversations.length === 0 ? (
                <p className="empty-state">还没有对话，开始你的第一次对话吧！</p>
              ) : (
                stats.recentConversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/memory/conversations/${c.id}`}
                    className="story-item"
                  >
                    <div className="story-item__meta">
                      <strong>{c.title}</strong>
                      <span>{formatDateTime(c.updatedAt)}</span>
                    </div>
                    {c.unread && <span className="story-item__badge">未读</span>}
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-card__head">
              <p className="panel-card__eyebrow">快速入口</p>
            </div>
            <div className="quick-links">
              <Link href="/chat/new" className="quick-link">
                <span className="quick-link__icon">💬</span>
                <span>开始对话</span>
              </Link>
              <Link href="/memory/documents" className="quick-link">
                <span className="quick-link__icon">📄</span>
                <span>文档记忆</span>
              </Link>
              <Link href="/memory/documents" className="quick-link">
                <span className="quick-link__icon">📥</span>
                <span>学习收件箱</span>
              </Link>
              <Link href="/memory/documents" className="quick-link">
                <span className="quick-link__icon">🕸️</span>
                <span>知识图谱</span>
              </Link>
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-card__head">
              <p className="panel-card__eyebrow">热门标签</p>
            </div>
            <div className="tag-cloud">
              {stats.topTags.length === 0 ? (
                <span className="status">暂无标签</span>
              ) : (
                stats.topTags.map((t) => (
                  <Link
                    key={t.word}
                    href={`/memory/documents?q=${encodeURIComponent(t.word)}`}
                    className="tag-cloud__tag"
                  >
                    {t.word}
                    <small>{t.count}</small>
                  </Link>
                ))
              )}
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-card__head">
              <p className="panel-card__eyebrow">概览</p>
            </div>
            <div className="meta-grid">
              <div className="meta-card meta-card--compact">
                <span className="meta-card__label">对话总数</span>
                <strong>{stats.convTotal}</strong>
              </div>
              <div className="meta-card meta-card--compact">
                <span className="meta-card__label">文档总数</span>
                <strong>{stats.docTotal}</strong>
              </div>
              <div className="meta-card meta-card--compact">
                <span className="meta-card__label">收件箱待处理</span>
                <strong>{stats.inbox.proposedCount}</strong>
              </div>
              <div className="meta-card meta-card--compact">
                <span className="meta-card__label">收件箱已暂缓</span>
                <strong>{stats.inbox.snoozedCount}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
    </AppShell>
  );
}
