# apps/web — MemoryNote v2 (Next.js 15)

> v2 是 MemoryNote 的**唯一前端 + 后端**实现:用 Next.js 15 App Router 同时承担 server load、API route、React UI。
> v1 (webapp + web-vue) 已删除,见 git tag v1.0.0。

## 状态

- ✅ 阶段 1 完成:`@core/core` 包抽离业务逻辑
- ✅ 阶段 2 完成:Next.js 骨架 + 首页 RSC
- ✅ 阶段 3 完成:P0 页面(列表/详情/流式 chat)
- ✅ 阶段 4 完成:数据迁移 + source CHECK 约束
- ✅ 阶段 5 完成:删 v1,只留 `apps/web`
- ⏳ 后续:知识图谱、词条、设置页

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

## 跟 v1 关系

v1 (webapp:3033 + web-vue:4173) **已删除**。v2 沿用 v1 的 PostgreSQL,
直接读 v1 已写入的数据(`Conversation` / `Document` / `Label` / `WikiEntry`)。
字段兼容,枚举已通过 CHECK 约束对齐。

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
| `/` | ✅ | 首页(总数/收件箱/最近对话/关键词云) |
| `/memory/documents` | ✅ | 文档+对话合并列表 |
| `/memory/conversations/[id]` | ✅ | 对话详情 + 继续对话 |
| `/chat/new` | ✅ | 新对话 |
| `/api/chat` | ✅ | 流式聊天 endpoint |
| `/memory/tags` | ⏳ | 关键词云(对应 v1 KeywordTagsView) |
| `/memory/labels` | ⏳ | 标签管理 |
| `/knowledge/inbox` | ⏳ | 学习收件箱 |
| `/knowledge/objects/[id]` | ⏳ | 知识对象详情 |
| `/wiki` | ⏳ | 词条列表 |
| `/wiki/[id]` | ⏳ | 词条详情 |
| `/settings/models` | ⏳ | LLM 模型配置 |
