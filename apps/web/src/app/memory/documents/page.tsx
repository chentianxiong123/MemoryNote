import Link from "next/link";
import type { Route } from "next";
import { prisma } from "@/lib/db";
import * as core from "@core/core";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    source?: string;
  }>;
}

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MemoryDocumentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = parseInt(sp.page || "1", 10);
  const limit = parseInt(sp.limit || "20", 10);
  const source = (sp.source as "upload" | "对话" | "all" | undefined) ?? "all";
  const search = sp.q || undefined;

  const data = await core.mergedList.listMergedMemory(prisma, {
    page,
    limit,
    source,
    search,
    excerptChars: 100,
  });

  const tagCloud = await core.search.getTagCloud(prisma, { minDocs: 2, limit: 80 });
  const filteredTags = core.search.filterDefaultValues(tagCloud);

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { page, limit, q: search, source, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "" || v === null) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    const path = qs ? `/memory/documents?${qs}` : "/memory/documents";
    return path as Route;
  };

  return (
    <AppShell>
      <SectionCard title="记忆文档" eyebrow="导入和管理你的记忆内容">
        <div className="meta-grid">
          <div className="meta-card">
            <span className="meta-card__label">文档总数</span>
            <strong>{data.totalCount}</strong>
          </div>
          <div className="meta-card">
            <span className="meta-card__label">来源数量</span>
            <strong>{data.convCount + data.docCount}</strong>
          </div>
        </div>

        <div className="toolbar">
          <form
            action="/memory/documents"
            method="GET"
            style={{ display: "flex", gap: "10px", flex: 1, flexWrap: "wrap" }}
          >
            <input
              name="q"
              defaultValue={search ?? ""}
              placeholder="搜索文档标题或内容..."
              className="input"
              style={{ flex: 1, minWidth: 200 }}
            />
            <select name="source" defaultValue={source} className="select">
              <option value="all">全部来源</option>
              <option value="对话">仅对话</option>
              <option value="upload">仅文档</option>
            </select>
            <button type="submit" className="button">
              搜索
            </button>
          </form>
        </div>

        {search && (
          <div className="keyword-filter">
            <span className="keyword-filter__label">当前筛选：</span>
            <span className="keyword-filter__tag">{search}</span>
            <Link href="/memory/documents" className="keyword-filter__clear" title="清除">
              ✕
            </Link>
          </div>
        )}

        <div className="tag-cloud">
          <span className="tag-cloud__label">热门标签：</span>
          {filteredTags.length === 0 ? (
            <span className="status">暂无标签</span>
          ) : (
            filteredTags.slice(0, 30).map((t) => (
              <Link
                key={t.word}
                href={`/memory/documents?q=${encodeURIComponent(t.word)}`}
                className={`tag-cloud__tag${search === t.word ? " tag-cloud__tag--active" : ""}`}
              >
                {t.word}
                <small>{t.doc_count}</small>
              </Link>
            ))
          )}
        </div>

        <div className="data-table">
          <div className="data-table__row data-table__row--head">
            <span>标题</span>
            <span>来源</span>
            <span>创建时间</span>
          </div>
          {data.items.length === 0 ? (
            <p className="empty-state">当前条件下没有文档。</p>
          ) : (
            data.items.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={
                  item.kind === "conversation"
                    ? `/memory/conversations/${item.id}`
                    : "/memory/documents"
                }
                className="data-table__row data-table__row--clickable"
              >
                <span className="doc-title">{item.title}</span>
                <span>{item.source || "手动录入"}</span>
                <span>{formatDateTime(item.updatedAt)}</span>
              </Link>
            ))
          )}
        </div>

        {data.totalPages > 1 && (
          <div className="pagination">
            {data.page > 1 ? (
              <Link href={buildHref({ page: data.page - 1 })} className="page-btn">
                上一页
              </Link>
            ) : (
              <button className="page-btn" disabled>
                上一页
              </button>
            )}
            <span className="page-info">
              第 {data.page} / {data.totalPages} 页 (共 {data.totalCount} 篇)
            </span>
            {data.page < data.totalPages ? (
              <Link href={buildHref({ page: data.page + 1 })} className="page-btn">
                下一页
              </Link>
            ) : (
              <button className="page-btn" disabled>
                下一页
              </button>
            )}
          </div>
        )}
      </SectionCard>
    </AppShell>
  );
}
