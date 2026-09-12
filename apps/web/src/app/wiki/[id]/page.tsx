import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import * as core from "@core/core";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getWikiEntry(id: string) {
  const [entry, versions] = await Promise.all([
    core.wiki.getWikiEntryById(prisma, id),
    core.wiki.getWikiEntryVersions(prisma, id),
  ]);
  if (!entry) return null;
  return { entry, versions };
}

const statusColors: Record<string, string> = {
  DRAFT: "#64748b",
  PUBLISHED: "#16a34a",
  REJECTED: "#ef4444",
};

export default async function WikiEntryPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getWikiEntry(id);
  if (!data) notFound();

  const { entry, versions } = data;

  return (
    <AppShell>
      <SectionCard title={entry.title} eyebrow={`版本 ${versions.length}`}>
        <div className="meta-grid" style={{ marginBottom: 16, gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="meta-card meta-card--compact">
            <span className="meta-card__label">状态</span>
            <strong style={{ color: statusColors[entry.status] }}>
              {entry.status === "DRAFT" ? "草稿" : entry.status === "PUBLISHED" ? "已发布" : "已拒绝"}
            </strong>
          </div>
          <div className="meta-card meta-card--compact">
            <span className="meta-card__label">创建时间</span>
            <strong>{entry.createdAt.toLocaleDateString("zh-CN")}</strong>
          </div>
          <div className="meta-card meta-card--compact">
            <span className="meta-card__label">更新时间</span>
            <strong>{entry.updatedAt.toLocaleDateString("zh-CN")}</strong>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {entry.definition && (
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: "0.85rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                定义
              </h4>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{entry.definition}</p>
            </div>
          )}
          {entry.summary && (
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: "0.85rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                摘要
              </h4>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{entry.summary}</p>
            </div>
          )}
          {entry.content && (
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: "0.85rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                内容
              </h4>
              <div className="thread__text" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{entry.content}</div>
            </div>
          )}
        </div>

        {versions.length > 1 && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              历史版本
            </h4>
            <div className="story-list">
              {versions.map((v) => (
                <div key={v.id} className="story-item" style={{ cursor: "default" }}>
                  <div className="story-item__meta">
                    <strong>V{v.version}</strong>
                    <span>{v.createdAt.toLocaleString("zh-CN")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
