"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const sections = [
  { label: "首页", to: "/", description: "仪表盘、统计概览" },
  { label: "对话", to: "/chat/new", description: "AI 对话" },
  { label: "知识工作台", to: "/memory/graph", description: "知识图谱可视化" },
  { label: "学习收件箱", to: "/memory/inbox", description: "待确认候选记忆" },
  { label: "文档记忆", to: "/memory/documents", description: "已存储的记忆文档" },
  { label: "维基", to: "/wiki", description: "结构化知识库" },
  { label: "标签", to: "/memory/labels", description: "记忆标签与分类管理" },
  { label: "模型设置", to: "/settings/models", description: "模型路由、API Key" },
];

function isNavActive(path: string, itemTo: string) {
  if (itemTo === "/") return path === "/";
  if (itemTo === "/chat/new") return path.startsWith("/chat");
  if (itemTo === "/memory/inbox") return path === "/memory/inbox";
  if (itemTo === "/wiki") return path === "/wiki" || path.startsWith("/wiki/");
  if (itemTo === "/settings/models") return path.startsWith("/settings");
  return path.startsWith(itemTo);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="brand">
          <div className="brand__badge">MN</div>
          <div>
            <p className="brand__eyebrow">知识沉淀系统</p>
            <h1 className="brand__title">MemoryNote</h1>
          </div>
        </div>

        <nav className="nav">
          {sections.map((item) => (
            <Link
              key={item.to}
              href={item.to as Route}
              className={`nav__item${isNavActive(pathname, item.to) ? " nav__item--active" : ""}`}
              title={item.description}
            >
              <span className="nav__label">{item.label}</span>
              <span className="nav__description">{item.description}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="sidebar-card__label">版本</p>
          <p className="sidebar-card__value">v2 · Next.js 15</p>
          <p className="sidebar-card__hint">单一前端 · React 19 · @core/core</p>
        </div>
      </aside>

      <main className="shell__content">
        <section className="shell__panel">{children}</section>
      </main>
    </div>
  );
}
