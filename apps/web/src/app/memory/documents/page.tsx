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
      <SectionCard title="记忆文档" eyebrow="已存储">
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

        <div className="meta-grid">
          <div className="meta-card meta-card--compact">
            <span className="meta-card__label">文档总数</span>
            <strong>{data.totalCount}</strong>
          </div>
          <div className="meta-card meta-card--compact">
            <span className="meta-card__label">来源数量</span>
            <strong>{data.convCount + data.docCount}</strong>
          </div>
        </div>

        <div className="data-table">
          <div className="data-table__row data-table__row--head">
            <span>标题</span>
            <span>类型</span>
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
                <span>{item.title}</span>
                <span>{item.kind === "conversation" ? "对话" : "文档"}</span>
                <span>{item.source || "手动录入"}</span>
                <span>{item.updatedAt.toISOString().slice(0, 10)}</span>
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
