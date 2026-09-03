# MemoryNote v1 → v2 迁移说明

> v2 目标:**彻底重写为单 Next.js + React 应用**,消灭 Remix + Vue 双栈。
> 本文档给 v2 启动者一份执行清单。

## 1. v2 启动前的硬性动作

### 1.1 归档 v1

```bash
# 当前 v1 主分支打 tag
git tag -a v1.0.0 -m "MemoryNote v1 freeze: Remix + Vue 双栈, 60+ API, 25 models"
git push origin v1.0.0

# 创建 v2 分支
git checkout -b v2/nextjs
git push -u origin v2/nextjs
```

### 1.2 v2 启动时**禁止**改动

- 数据库 schema(只在新建分支建新 schema)
- `apps/webapp`(冻结,只读)
- `apps/web-vue`(冻结,只读)
- 已有的 1742 条对话、160 条文档、6563 条关键词

### 1.3 v2 启动时**保留**

- `packages/database`(`@core/database` Prisma client + schema)
- `packages/providers`(LLM/Embedding 抽象)
- `docker-compose.dev.yaml`(基础设施不变)
- `docs/v1/` 全部内容(只读)
- 真实数据

## 2. v2 目录结构(目标)

```
MemoryNote/
├── apps/
│   └── web/                     # Next.js 15 App Router(唯一前端+后端)
│       ├── app/                 # 路由
│       │   ├── (memory)/        # 记忆模块
│       │   │   ├── documents/
│       │   │   ├── conversations/
│       │   │   ├── tags/
│       │   │   └── graph/
│       │   ├── (knowledge)/     # 知识模块
│       │   │   ├── inbox/
│       │   │   ├── objects/
│       │   │   └── wiki/
│       │   ├── (settings)/
│       │   ├── api/             # 仅给客户端 fetch 用的 endpoint
│       │   └── layout.tsx
│       ├── components/          # React 组件
│       ├── lib/                 # 客户端工具
│       └── next.config.ts
├── packages/
│   ├── database/                # 保留(Prisma)
│   ├── providers/               # 保留(LLM/Embedding)
│   ├── types/                   # 保留
│   └── core/                    # ← 新增:业务逻辑
│       ├── src/
│       │   ├── conversation.ts
│       │   ├── document.ts
│       │   ├── tag.ts
│       │   ├── wiki.ts
│       │   ├── knowledge.ts
│       │   ├── search.ts
│       │   ├── agent.ts
│       │   └── index.ts
│       └── package.json
└── docs/
    ├── v1/                      # 归档(只读)
    └── v2/                      # v2 新文档
```

### 2.1 变化一览

| v1 | v2 | 理由 |
|----|----|------|
| `apps/webapp`(Remix/Express 3033) | **删除** | 改用 Next.js 内置 server |
| `apps/web-vue`(Vue SPA 4173) | **删除** | 改用 React |
| `services/*.server.ts` 30 个文件 | 拆为 `core/*.ts` 7-8 个文件 | 业务与框架解耦 |
| 60+ Express 路由 | Next.js RSC + Server Action | 数据直查,不绕 HTTP |
| 25 个 Prisma model | 审计合并后预计 15-18 | 合并 `*Embedding` 等 |
| 11 个 migration | 重建 schema,只保留 1 个初始 migration | 旧 schema 杂乱 |
| 双进程启动 | 单 `next dev` | 减运维 |
| `tsx watch` | Next.js 自带 | 更稳 |
| `@mastra/*` 深度耦合 | 抽 `core/agent`,Mastra 降为可选 driver | 易升级 |

## 3. 迁移阶段

### 阶段 1:抽 `packages/core`(基础设施)

- 新建 `packages/core/`
- 把 `webapp/app/services/` 下的 6 个核心服务迁过去:
  - `conversation.server.ts` → `core/conversation.ts`
  - `document.server.ts` → `core/document.ts`
  - `label.server.ts` → `core/tag.ts`(改名,语义更清楚)
  - `wikiEntry.server.ts` → `core/wiki.ts`
  - `knowledge-capture.server.ts` → `core/knowledge.ts`
  - `search.server.ts` → `core/search.ts`
- 每个文件 < 400 行,单一职责
- 核心函数不依赖 Remix,只依赖 `@core/database` 和 `@core/providers`
- 单元测试:覆盖率 > 60%

**预计 3-5 天**。

### 阶段 2:起 Next.js 骨架

```bash
cd apps
pnpm create next-app@latest web \
  --typescript --tailwind --app --src-dir false \
  --import-alias "@/*" --no-eslint
```

- 装 `@core/database` `@core/providers` `@core/types` `@core/core` workspace 依赖
- 装 `prisma` 客户端(不装 CLI,已由 `@core/database` 提供)
- 装 `ai` `@ai-sdk/openai` `@ai-sdk/anthropic` 流式响应
- 装 `zod` schema 校验

**预计 1-2 天**。

### 阶段 3:迁移页面(按用户价值排序)

| 优先级 | 页面 | 复杂度 | 解决 v1 bug |
|--------|------|--------|------------|
| P0 | 记忆文档列表 | 中 | ✅ A1 总数 1902 |
| P0 | 对话详情 | 中 | - |
| P1 | 对话流式聊天 | 高 | - |
| P1 | 关键词云 | 低 | - |
| P1 | 标签管理 | 低 | - |
| P2 | 知识收件箱 | 高 | - |
| P2 | 知识对象/图谱 | 极高 | - |
| P3 | 词条 wiki | 中 | - |
| P3 | LLM 设置 | 低 | - |

**P0 优先完成,证明 v2 跑通**。每完成一个 P0 立刻 commit,确保 git 历史清晰。

**预计 7-10 天**。

### 阶段 4:数据迁移(零停服)

v1 和 v2 共用同一 PostgreSQL(共用 `docker-compose.dev.yaml`):

- v1 服务期间持续运行
- v2 直接读 v1 写入的数据(`Conversation` / `Document` / `Label` / `WikiEntry`)
- 字段兼容:
  - `Conversation.source` 脏值在 v2 启动脚本中清洗为受控枚举
  - `KnowledgeCaptureItem` 状态枚举保持兼容
- 必要时用 `prisma migrate diff` 生成增量 migration,**不重置数据库**

**预计 1-2 天**。

### 阶段 5:删 v1

- 删 `apps/webapp/`
- 删 `apps/web-vue/`
- 删 Remix/Vue 相关 `package.json` 依赖
- 删 `docs/v1/`(或保留为只读归档)
- 更新根 `README.md` / `package.json` scripts

**预计 1 天**。

## 4. v1 → v2 路由映射

| v1 路径 | v2 路径 | 实现方式 |
|---------|---------|---------|
| `/home/memory/documents` | `/memory/documents` | RSC + `prisma.conversation.findMany` + `prisma.document.findMany` |
| `/conversations/:id` | `/memory/conversations/:id` | RSC + `core/conversation.ts.getById` |
| `/home/memory/keywords` | `/memory/tags` | RSC + `core/tag.ts.cloud()` |
| `/home/memory/labels` | `/memory/labels` | RSC + `core/tag.ts.labels()` |
| `/home/knowledge/inbox` | `/knowledge/inbox` | RSC + `core/knowledge.ts.inbox()` |
| `/home/knowledge/objects/:id` | `/knowledge/objects/:id` | RSC + 客户端图 |
| `/home/wiki` | `/wiki` | RSC + `core/wiki.ts.list()` |
| `/home/wiki/:id` | `/wiki/:id` | RSC + `core/wiki.ts.getById()` |
| `/home/settings/models` | `/settings/models` | RSC + Server Action |

## 5. 关键代码片段(v2 起点)

### 5.1 `apps/web/app/memory/documents/page.tsx`

```tsx
import { prisma } from '@core/database'
import { DocumentList } from '@/components/DocumentList'

export default async function DocumentsPage() {
  const [conversations, documents, convTotal, docTotal] = await Promise.all([
    prisma.conversation.findMany({
      where: { deleted: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.document.findMany({
      where: { deleted: null },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.conversation.count({ where: { deleted: null } }),
    prisma.document.count({ where: { deleted: null } }),
  ])
  // 合并/排序/分页都在内存里做,RSC 一次渲染,客户端零 API
  ...
}
```

### 5.2 流式聊天(`apps/web/app/memory/conversations/[id]/chat.tsx`)

```tsx
'use client'
import { useChat } from '@ai-sdk/react'

export function ChatPanel({ conversationId }: { conversationId: string }) {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
    body: { conversationId },
  })
  ...
}
```

```ts
// apps/web/app/api/chat/route.ts
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { coreChat } from '@core/core/agent'

export async function POST(req: Request) {
  const { conversationId, messages } = await req.json()
  const result = await coreChat({ conversationId, messages, model: openai('gpt-5.2') })
  return result.toDataStreamResponse()
}
```

### 5.3 `packages/core/src/conversation.ts`(节选)

```ts
import { prisma } from '@core/database'

export async function listConversations(opts: { limit: number; cursor?: string }) {
  return prisma.conversation.findMany({
    where: { deleted: null },
    orderBy: { updatedAt: 'desc' },
    take: opts.limit,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  })
}

export async function getConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      ConversationHistory: { orderBy: { sortOrder: 'asc' } },
    },
  })
}
```

## 6. 风险与回退

| 风险 | 缓解 |
|------|------|
| v2 启动慢影响日常使用 | v1 保留运行,v2 通过不同端口(3000)并行 |
| 数据迁移出错 | v2 直接读 v1 写的表,不动 schema |
| 失去 Vue 的快速原型 | v2 用 `app/api/route.ts` 临时 endpoint 验证 |
| Mastra 升级困难 | v2 抽 `core/agent` 时一次性解耦 |

## 7. 验收标准

v2 何时算"可以删 v1":

- [ ] P0 三个页面(文档列表/对话详情/聊天)与 v1 功能等价
- [ ] v1 总数 1902 在 v2 显示正确
- [ ] LLM 流式聊天在 v2 端到端跑通
- [ ] 单元测试覆盖率 > 60%
- [ ] `pnpm dev` 单命令启动所有服务
- [ ] `pnpm build` 产物 < 50MB
- [ ] 类型检查 `pnpm typecheck` 0 报错
- [ ] 连续运行 24 小时无内存泄漏
- [ ] 文档(v2 目录)写完

## 8. 联系方式

- v1 主要维护者:a1
- v2 启动日:2026-09-03
- v1 冻结日:同 v2 启动日
- v1 归档 tag:`v1.0.0`
- v2 分支:`v2/nextjs`
