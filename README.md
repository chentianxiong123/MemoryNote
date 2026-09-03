# MemoryNote v2

> 单 Next.js 15 + React 19 应用,直接接 PostgreSQL。
> v1 (Remix 后端 + Vue 前端) 已在 [v1.0.0 tag](https://github.com/chentianxiong123/MemoryNote/releases/tag/v1.0.0) 归档,代码已删除。

## 一句话定位

个人长期知识增长的 AI 对话与文档工作台,把日常和 AI 的对话、笔记、文档沉淀为可确认、可追溯的个人百科词条。

## 架构

```
┌────────────────────────────────────────────────────┐
│                   MemoryNote v2                    │
├────────────────────────────────────────────────────┤
│                                                    │
│  apps/web/        Next.js 15.5 + React 19         │
│  (port 3000)     ├─ React Server Components (RSC) │
│                   │   直接调 @core/core,0 个 API  │
│                   ├─ Route handlers (api/chat)    │
│                   └─ ai-sdk 6 streamText (流式)   │
│                                                    │
│  packages/core/   纯 TS,无框架依赖                 │
│                   ├─ conversation.ts              │
│                   ├─ document.ts                  │
│                   ├─ tag.ts                       │
│                   ├─ wiki.ts                      │
│                   ├─ knowledge.ts                 │
│                   ├─ search.ts                    │
│                   └─ mergedList.ts                │
│                                                    │
│  packages/database/  Prisma 5.4 + 25 model        │
│  packages/providers/ LLM / Embedding 抽象         │
│  packages/types/     共享枚举                      │
│                                                    │
│  PostgreSQL 16  ┐                                  │
│  + pgvector      ├─ docker compose 本地            │
│  (port 5433)    ┘                                  │
└────────────────────────────────────────────────────┘
```

## 启动

```bash
# 1. 基础设施
docker compose -f docker-compose.dev.yaml up -d

# 2. 依赖
pnpm install

# 3. 数据库迁移
pnpm db:migrate

# 4. 启动(单命令)
pnpm dev
```

打开 http://localhost:3000

`.env` 至少需要:
- `DATABASE_URL` (默认 `postgresql://docker:docker@localhost:5433/memorynote?schema=memorynote`)
- `OPENAI_API_KEY` (流式 chat 需要)

可选:
- `OPENAI_BASE_URL` (默认 `https://api.openai.com/v1`,OpenAI-compatible endpoint 可改)
- `MODEL` (默认 `gpt-4o-mini`)

## 路由

| 路径 | 类型 | 说明 |
|------|------|------|
| `/` | RSC | 首页:总数 / 收件箱 / 最近对话 / Top 10 关键词 |
| `/memory/documents` | RSC | 对话+文档合并列表 + 搜索 + 分页 |
| `/memory/conversations/[id]` | RSC + 客户端 | 对话详情 + 继续对话 |
| `/chat/new` | 客户端 | 新对话入口 |
| `/api/chat` | API | 流式聊天 endpoint(SSE) |

## 数据模型

25 个 Prisma model 集中在 [`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma)。
最近加的 CHECK 约束保证 `Conversation.source` 和 `Document.source` 只接受受控枚举值,详见
[`prisma/migrations/20260903_clean_source/`](packages/database/prisma/migrations/20260903_clean_source/)。

## v1 → v2 迁移历史

- `v1.0.0` tag: 完整 v1 架构文档 + 已知问题清单
- 阶段 1: 抽 `@core/core` 包(commit `94bff650`)
- 阶段 2: Next.js 15 骨架(commit `47251255`)
- 阶段 3: P0 页面 + 流式 chat(commit `31b58cf1`)
- 阶段 4: source 枚举清洗 + CHECK 约束 + 删 document_fts
- 阶段 5: 删 webapp + web-vue

## 来源与协议

本项目基于开源项目 CORE by RedPlanetHQ 改造,保留原项目的协议约束。详见 [LICENSE](LICENSE)。
