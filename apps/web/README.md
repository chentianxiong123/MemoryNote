# apps/web — MemoryNote v2 (Next.js 15)

> v2 是 MemoryNote 的**单前端**实现:用 Next.js 15 App Router 同时承担 server load、API route、React UI。

## 状态

- ✅ 阶段 1 完成:`@core/core` 包抽离业务逻辑
- ✅ 阶段 2 完成:Next.js 骨架 + 首页 RSC
- ⏳ 阶段 3 待做:迁移剩余页面(对话/收件箱/词条)
- ⏳ 阶段 4 待做:数据迁移脚本
- ⏳ 阶段 5 待做:删 webapp / web-vue

## 启动

```bash
# 1. 基础设施(同 v1)
docker compose -f docker-compose.dev.yaml up -d

# 2. 依赖(同 v1)
pnpm install

# 3. 启动 v2(端口 3000)
pnpm --filter web dev
```

打开 http://localhost:3000/

## 跟 v1 并行

v1 (webapp:3033 + web-vue:4173) 和 v2 (web:3000) **共用同一份 PostgreSQL**。
修改 v2 不会破坏 v1,因为:

- v2 只读 webapp 已写的数据
- v2 写新数据走 webapp 同一 schema
- 字段兼容,枚举值已对齐

## 关键设计

### RSC 直查,不绕 HTTP
首页 `src/app/page.tsx` 直接 `prisma.conversation.count() + prisma.document.count()`,
**0 个 API endpoint**。这正是 v1 老 bug("文档总数显示 160 不显示 1902")
在 v2 自动消失的原因——RSC 一次拿到全部数据,客户端不需要拼装。

### 业务逻辑在 `@core/core`
`import * as core from "@core/core"` 直接调用抽离好的函数,不在 web 层写业务。

### Prisma client 单例
`src/lib/db.ts` 用 `globalThis` 缓存,dev 模式 HMR 不会泄漏连接。

## 路由

| 路径 | 状态 | 说明 |
|------|------|------|
| `/` | ✅ 已实现 | 首页(总数/收件箱/最近对话/关键词云) |
| `/memory/documents` | ⏳ | 文档+对话合并列表(对应 v1 MemoryDocumentsView) |
| `/memory/conversations/[id]` | ⏳ | 对话详情 |
| `/memory/tags` | ⏳ | 关键词云(对应 v1 KeywordTagsView) |
| `/memory/labels` | ⏳ | 标签管理 |
| `/knowledge/inbox` | ⏳ | 学习收件箱 |
| `/knowledge/objects/[id]` | ⏳ | 知识对象详情 |
| `/wiki` | ⏳ | 词条列表 |
| `/wiki/[id]` | ⏳ | 词条详情 |
| `/settings/models` | ⏳ | LLM 模型配置 |
| `/api/chat` | ⏳ | 流式聊天 endpoint |
