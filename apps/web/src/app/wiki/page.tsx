import Link from "next/link";
import { prisma } from "@/lib/db";
import * as core from "@core/core";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export const dynamic = "force-dynamic";

async function getWikiData() {
  const [entries, counts] = await Promise.all([
    core.wiki.getWikiEntries(prisma, {}),
    core.wiki.getWikiEntryStatusCounts(prisma),
  ]);
  return { entries, counts };
}

const statusColors: Record<string, string> = {
  DRAFT: "#64748b",
  PUBLISHED: "#16a34a",
  REJECTED: "#ef4444",
};

export default async function WikiListPage() {
  const { entries, counts } = await getWikiData();

  return (
    <AppShell>
      <SectionCard title="维基" eyebrow="结构化知识库">
        <div className="meta-grid" style={{ marginBottom: 20 }}>
          <div className="meta-card">
            <span className="meta-card__label">已发布</span>
            <strong style={{ color: statusColors.PUBLISHED }}>{counts.PUBLISHED}</strong>
          </div>
          <div className="meta-card">
            <span className="meta-card__label">草稿</span>
            <strong style={{ color: statusColors.DRAFT }}>{counts.DRAFT}</strong>
          </div>
          <div className="meta-card">
            <span className="meta-card__label">已拒绝</span>
            <strong style={{ color: statusColors.REJECTED }}>{counts.REJECTED}</strong>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: "3rem" }}>📚</div>
            <p style={{ margin: 0, color: "var(--text-soft)" }}>维基为空</p>
            <p style={{ margin: 0, color: "var(--text-soft)", fontSize: "0.9rem" }}>
              系统会从对话中自动提取结构化知识并创建维基条目
            </p>
          </div>
        ) : (
          <div className="story-list">
            {entries.map((e) => (
              <Link key={e.id} href={`/wiki/${e.id}`} className="story-item">
                <div className="story-item__meta">
                  <strong>{e.title}</strong>
                  <span>{e.createdAt.toLocaleDateString("zh-CN")} · {e.updatedAt.toLocaleDateString("zh-CN")}</span>
                </div>
                <span className="story-item__badge" style={{ background: `${statusColors[e.status]}22`, color: statusColors[e.status] }}>
                  {e.status === "DRAFT" ? "草稿" : e.status === "PUBLISHED" ? "已发布" : "已拒绝"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
