import { prisma } from "@/lib/db";
import * as core from "@core/core";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    proposed: "待确认",
    accepted: "已接受",
    rejected: "已忽略",
    snoozed: "稍后再看",
    merged: "已合并",
  };
  return labels[status] || status;
}

export default async function InboxPage() {
  const [stats, batches] = await Promise.all([
    core.knowledge.getInboxStats(prisma),
    core.knowledge.listInboxBatches(prisma, 20),
  ]);

  return (
    <AppShell>
      <SectionCard title="学习收件箱" eyebrow="待确认候选记忆">
        <div className="meta-grid" style={{ marginBottom: 20 }}>
          <div className="meta-card">
            <span className="meta-card__label">待确认</span>
            <strong>{stats.proposedCount}</strong>
          </div>
          <div className="meta-card">
            <span className="meta-card__label">稍后再看</span>
            <strong>{stats.snoozedCount}</strong>
          </div>
          <div className="meta-card">
            <span className="meta-card__label">总批次数</span>
            <strong>{stats.batchCount}</strong>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: "3rem" }}>📥</div>
            <p style={{ margin: 0, color: "var(--text-soft)" }}>收件箱为空</p>
            <p style={{ margin: 0, color: "var(--text-soft)", fontSize: "0.9rem" }}>
              与 AI 对话后,待确认的知识项会出现在这里
            </p>
          </div>
        ) : (
          <div className="story-list">
            {batches.map((b) => (
              <article key={b.id} className="story-item">
                <div className="story-item__meta">
                  <strong>批次 {b.id.slice(0, 8)}</strong>
                  <span>{b.itemCount} 项 · {statusLabel(b.status)} · {b.createdAt.toLocaleDateString("zh-CN")}</span>
                </div>
                <span className="story-item__badge">{b.proposedCount} 待处理</span>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
