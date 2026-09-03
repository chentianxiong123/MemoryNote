import Link from "next/link";
import type { Route } from "next";
import { prisma } from "@/lib/db";
import * as core from "@core/core";

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
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "var(--muted)" }}>← 返回</Link>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>记忆文档</h1>
        <p style={{ color: "var(--muted)", marginTop: 4, fontSize: 12 }}>
          共 {data.totalCount} 项(对话 {data.convCount} + 文档 {data.docCount}) ·
          第 {data.page}/{data.totalPages} 页
        </p>
      </header>

      <form
        action="/memory/documents"
        method="GET"
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          name="q"
          defaultValue={search ?? ""}
          placeholder="搜索标题或内容…"
          style={{
            flex: 1,
            padding: "6px 10px",
            background: "#111",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 13,
          }}
        />
        <select
          name="source"
          defaultValue={source}
          style={{
            padding: "6px 10px",
            background: "#111",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 13,
          }}
        >
          <option value="all">全部</option>
          <option value="对话">仅对话</option>
          <option value="upload">仅文档</option>
        </select>
        <button
          type="submit"
          style={{
            padding: "6px 14px",
            background: "var(--accent)",
            color: "#fff",
            border: 0,
            borderRadius: 4,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          搜索
        </button>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
            <th style={{ padding: "8px 4px", width: 70 }}>类型</th>
            <th style={{ padding: "8px 4px" }}>标题</th>
            <th style={{ padding: "8px 4px" }}>摘要</th>
            <th style={{ padding: "8px 4px", width: 90 }}>来源</th>
            <th style={{ padding: "8px 4px", width: 110 }}>更新时间</th>
          </tr>
        </thead>
        <tbody>
          {data.items.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                无数据
              </td>
            </tr>
          ) : (
            data.items.map((item) => (
              <tr key={`${item.kind}-${item.id}`} style={{ borderBottom: "1px solid #1a1a1a" }}>
                <td style={{ padding: "8px 4px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 3,
                      fontSize: 11,
                      background: item.kind === "conversation" ? "#1a2e1a" : "#2e1a1a",
                      color: item.kind === "conversation" ? "#7fd07f" : "#d07f7f",
                    }}
                  >
                    {item.kind === "conversation" ? "对话" : "文档"}
                  </span>
                </td>
                <td style={{ padding: "8px 4px" }}>
                  {item.kind === "conversation" ? (
                    <Link href={`/memory/conversations/${item.id}` as Route}>{item.title}</Link>
                  ) : (
                    <span>{item.title}</span>
                  )}
                </td>
                <td style={{ padding: "8px 4px", color: "var(--muted)" }}>
                  {item.excerpt ?? <em>—</em>}
                </td>
                <td style={{ padding: "8px 4px", color: "var(--muted)" }}>{item.source}</td>
                <td style={{ padding: "8px 4px", color: "var(--muted)" }}>
                  {item.updatedAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <nav style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
        {data.page > 1 && <Link href={buildHref({ page: data.page - 1 })}>← 上一页</Link>}
        <span style={{ color: "var(--muted)" }}>{data.page} / {data.totalPages}</span>
        {data.page < data.totalPages && (
          <Link href={buildHref({ page: data.page + 1 })}>下一页 →</Link>
        )}
      </nav>
    </main>
  );
}
