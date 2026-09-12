import { prisma } from "@/lib/db";
import * as core from "@core/core";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LabelsPage() {
  const [labels, tags] = await Promise.all([
    core.tag.getWorkspaceLabelsWithCounts(prisma),
    core.search.getTagCloud(prisma, { minDocs: 1, limit: 200 }),
  ]);

  const filteredTags = core.search.filterDefaultValues(tags);

  return (
    <AppShell>
      <SectionCard title="标签" eyebrow="记忆标签与分类管理">
        <div className="meta-grid" style={{ marginBottom: 16 }}>
          <div className="meta-card meta-card--compact">
            <span className="meta-card__label">自定义标签</span>
            <strong>{labels.length}</strong>
          </div>
          <div className="meta-card meta-card--compact">
            <span className="meta-card__label">自动标签</span>
            <strong>{filteredTags.length}</strong>
          </div>
        </div>

        {labels.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              自定义标签
            </h4>
            <div className="data-table">
              <div className="data-table__row data-table__row--head">
                <span>名称</span>
                <span>描述</span>
                <span>文档数</span>
              </div>
              {labels.map((l) => (
                <div key={l.id} className="data-table__row">
                  <span style={{ fontWeight: 500 }}>{l.name}</span>
                  <span style={{ color: "var(--text-soft)" }}>{l.description || "—"}</span>
                  <span>{l.documentCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            关键词标签
          </h4>
          {filteredTags.length === 0 ? (
            <p className="empty-state">暂无关键词标签</p>
          ) : (
            <div className="tag-cloud">
              {filteredTags.slice(0, 50).map((t) => (
                <span key={t.word} className="tag-cloud__tag">
                  {t.word}
                  <small>{t.doc_count}</small>
                </span>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </AppShell>
  );
}
