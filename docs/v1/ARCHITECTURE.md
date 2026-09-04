# MemoryNote v1 架构总览(冻结快照)

> v1 是 MemoryNote 的早期 **Remix 后端 + Vue 3 前端** 双栈版本。
> 本文是 v1 收尾归档，代码已在 `v1.0.0` tag 冻结。

**最后更新**: 2026-09-03
**版本**: v1.0.0
**对应代码 commit**: `20b4dd90` (主分支 HEAD,v2 启动前还会有一笔收尾 commit)

---

## 1. 一句话定位

> 个人长期知识增长的 AI 对话与文档工作台,支持把对话、笔记、文档沉淀为可确认、可追溯的个人百科词条。

## 2. 顶层架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          MemoryNote v1                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐   HTTP/JSON   ┌────────────────────────────┐  │
│  │  apps/web-vue   │ ◄──────────► │       apps/webapp           │  │
│  │  (Vue 3 SPA)    │              │  (Remix/Express 服务)        │  │
│  │  Port: 4173     │              │  Port: 3033                │  │
│  └─────────────────┘              │  - 60+ API 路由            │  │
│                                    │  - LLM 流式聊天             │  │
│                                    │  - 知识图谱写入             │  │
│                                    │  - 文档/对话管理            │  │
│                                    └────────────┬───────────────┘  │
│                                                 │                   │
│  ┌──────────────────────────────────────────────┼────────────────┐ │
│  │              packages(共享层)                │                 │ │
│  │  ┌─────────────┐ ┌──────────────┐ ┌────────┴────────┐       │ │
│  │  │  database   │ │  providers   │ │     types        │       │ │
│  │  │  Prisma 5.4 │ │  LLM/Embed   │ │  共享 TS 类型     │       │ │
│  │  │  PostgreSQL │ │  Neo4j 驱动  │ │                 │       │ │
│  │  └─────────────┘ └──────────────┘ └─────────────────┘       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 基础设施(Docker,localhost)                                    │  │
│  │  ┌────────────┐ ┌────────────┐                                │  │
│  │  │ PostgreSQL │ │   Neo4j    │                                │  │
│  │  │   :5433    │ │   :7687    │                                │  │
│  │  │  +pgvector │ │            │                                │  │
│  │  └────────────┘ └────────────┘                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. 仓库结构

```
MemoryNote/
├── apps/
│   ├── webapp/                 # Remix/Express 后端(3033)
│   │   ├── server.ts           # Express 启动入口
│   │   ├── app/
│   │   │   ├── routes/         # 60+ 个 api.v1.*.tsx 路由
│   │   │   ├── services/       # 业务逻辑层(30+ 文件,约 9000 行)
│   │   │   ├── models/         # user / workspace
│   │   │   ├── jobs/           # 后台任务(对话/摄入/标题生成)
│   │   │   ├── lib/            # 工具
│   │   │   └── config/         # 配置
│   │   └── scripts/            # 一次性脚本
│   └── web-vue/                # Vue 3 前端(4173)
│       ├── index.html
│       └── src/
│           ├── views/          # 15 个页面级组件
│           ├── components/     # 4 个共享组件
│           ├── stores/         # Pinia 状态
│           ├── lib/            # API 客户端、图工具
│           ├── router.ts
│           └── main.ts
├── packages/
│   ├── database/               # Prisma schema + client 封装
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # 25 个 model,570 行
│   │   │   └── migrations/     # 11 个迁移
│   │   └── src/
│   │       ├── index.ts        # 转发 @prisma/client
│   │       └── transaction.ts  # 事务/重试工具
│   ├── providers/              # LLM / Embedding / Vector / Graph
│   │   └── src/
│   │       ├── factory.ts      # ProviderFactory
│   │       ├── model/          # OpenAI / Anthropic / Azure
│   │       ├── vector/         # pgvector
│   │       └── graph/          # Neo4j
│   └── types/                  # 共享类型
│       └── src/
│           ├── conversation-execution-step/
│           ├── graph/
│           ├── llm/
│           ├── oauth/
│           ├── search.ts
│           └── user/
├── docs/                       # 文档
│   ├── v1/                     # ← v1 收尾文档(本目录)
│   ├── architecture-closed-loop.md
│   ├── PROJECT_HANDOVER.md
│   └── PROJECT_TAKEOVER.md
├── docker-compose.dev.yaml     # Postgres :5433 + Neo4j :7687
├── turbo.json                  # Turbo 任务编排
├── pnpm-workspace.yaml
└── package.json                # 顶层 scripts
```

## 4. 技术栈清单

| 层级 | 选型 | 版本 | 用途 |
|------|------|------|------|
| **包管理** | pnpm + Turbo | pnpm 9.0.0 / turbo 2.5.3 | workspace 编排 |
| **Node** | Node.js | >=20 | 运行时 |
| **后端** | Remix/Express + tsx | tsx watch | server.ts → Express |
| **ORM** | Prisma | 5.4.1 | PostgreSQL 访问 |
| **数据库** | PostgreSQL 16 + pgvector | pgvector/pgvector:pg16 | 业务存储 + 向量 |
| **图谱** | Neo4j 5 | neo4j:5 | 知识图谱 |
| **前端框架** | Vue 3 | 3.5.13 | Composition API |
| **路由** | vue-router | 4.5.1 | SPA 路由 |
| **状态** | Pinia | 2.3.1 | 状态管理 |
| **图可视化** | sigma + graphology | 3.0.2 / 0.26.0 | 前端图渲染 |
| **AI 框架** | Mastra | 1.36.0 | Agent 编排 |
| **AI SDK** | Vercel AI SDK | 6.0.72 | 流式响应 |
| **LLM 提供商** | OpenAI / Anthropic / Azure / OpenAI-compatible | 多版本 | 模型调用 |
| **样式** | Tailwind | (在 webapp 内) | 仅后端模板 |
| **嵌入** | 多种 | - | 句向量 |

## 5. 数据库 Schema(25 个 model)

### 5.1 核心业务表

| Model | 说明 | 关键字段 |
|-------|------|---------|
| `Conversation` | AI 对话会话 | `id`, `title`, `source`, `status`, `activeStreamId` |
| `ConversationHistory` | 对话消息 | `message`, `userType`, `conversationId`, `sortOrder` |
| `Document` | 文档(上传/摄入) | `source`, `type`, `status`, `content`, `sessionId` |
| `Label` | 标签 | `name`, `kind`, `status` |
| `IngestionQueue` | 摄入队列 | `documentId`, `status`, `ruleId` |
| `IngestionRule` | 摄入规则 | `name`, `actions` |
| `Task` | 任务 | `title`, `status`, `dueAt` |
| `Page` | 笔记/页面 | `title`, `content` |
| `ButlerComment` | 管家评论 | `relativePods`, `text` |
| `Reminder` | 提醒 | `title`, `time` |
| `BlockedKeyword` | 屏蔽词 | `keyword`, `kind` |

### 5.2 知识图谱相关

| Model | 说明 |
|-------|------|
| `KnowledgeCaptureBatch` | 知识抽取批次(per conversation) |
| `KnowledgeCaptureItem` | 候选实体/关系/事件/决策(用户待确认) |
| `WikiEntry` | 个人百科词条(已确认) |
| `WikiEntryVersion` | 词条历史版本 |
| `RecallLog` | 召回日志(用于评估) |

### 5.3 嵌入与向量

| Model | 类型 |
|-------|------|
| `CompactedSessionEmbedding` | 会话压缩向量 |
| `EntityEmbedding` | 实体向量 |
| `LabelEmbedding` | 标签向量 |
| `EpisodeEmbedding` | Episode 向量 |
| `StatementEmbedding` | Statement 向量 |
| `VoiceAspect` / `VoiceAspectEmbedding` | 声音画像 |

### 5.4 LLM 配置

| Model | 说明 |
|-------|------|
| `LLMProvider` | 提供商(openai/anthropic/azure/...) |
| `LLMModel` | 具体模型配置 |

### 5.5 关键索引(文档)

```prisma
@@index([source])
@@index([status])
@@index([sessionId])
```

### 5.6 关键视图(SQL 层)

| 视图 | 作用 |
|------|------|
| `document_fts` | `to_tsvector('simple', content \|\| ' ' \|\| title)` 全文搜索 |
| `conversation_keywords` | 从 `ConversationHistory.message` 提取的高频词 |

> **注意** `document_fts` 用了 `simple` 配置,中文不分词,Chinese 视为整词匹配。
> v2 考虑改用 `jieba` 字典或加 `pg_trgm`。

## 6. 后端 API 清单(60+ 路由)

> 完整列表见 `apps/webapp/app/routes/api.v1.*.tsx`

### 6.1 对话

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/conversations` | 对话列表 |
| GET | `/api/v1/conversation/:id` | 对话详情 |
| GET | `/api/v1/conversation/:id/read` | 标记已读 |
| PATCH | `/api/v1/conversation/:id/update` | 改标题/属性 |
| DELETE | `/api/v1/conversation/:id/delete` | 删除 |
| POST | `/api/v1/conversation/create` | 新建 |
| POST | `/api/v1/conversation/reply` | 发起回复 |
| GET | `/api/v1/conversation/:streamId/stream` | SSE 流 |
| POST | `/api/v1/conversations/read-all` | 全部已读 |
| POST | `/api/v1/conversations/delete-source` | 按 source 批量删 |

### 6.2 聊天

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/chat` | 单次聊天(向后兼容) |
| POST | `/api/v1/chat/session/create` | 创建聊天 session |

### 6.3 文档

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/documents` | 文档列表(支持 `?source=对话\|upload`) |
| GET | `/api/v1/documents/:id` | 文档详情 |
| GET | `/api/v1/documents/search` | 文档搜索 |
| GET | `/api/v1/documents/session/:sessionId` | 按 session |
| POST | `/api/v1/documents` | 上传/创建 |
| POST | `/api/v1/document-import` | 导入 |
| POST | `/api/v1/documents/:id/retry` | 重试摄入 |
| GET | `/api/v1/documents/export` | 导出 |

### 6.4 标签 / 关键词

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/labels` | 标签列表 |
| GET | `/api/v1/labels/:id` | 标签详情 |
| GET | `/api/v1/tags` | 关键词云(合并 `document_keywords` + `conversation_keywords`) |
| GET | `/api/v1/keyword-search` | 关键词搜索 |
| GET | `/api/v1/blocked-keywords` | 屏蔽词 |

### 6.5 知识图谱 / 百科

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/knowledge/home` | 知识首页 |
| GET | `/api/v1/knowledge/inbox` | 学习收件箱 |
| POST | `/api/v1/knowledge/inbox/:id/{accept,reject,merge,snooze}` | 收件箱操作 |
| GET | `/api/v1/knowledge/objects/:id` | 对象详情 |
| GET | `/api/v1/knowledge/objects/:id/graph` | 对象图(局部) |
| GET | `/api/v1/knowledge/search` | 知识搜索 |
| GET | `/api/v1/wiki/entries` | 词条列表 |
| GET | `/api/v1/wiki/entries/:uuid` | 词条详情 |
| GET | `/api/v1/wiki/entries/:uuid/timeline` | 时间线 |
| GET | `/api/v1/wiki/entries/:uuid/versions` | 版本 |
| POST | `/api/v1/wiki/entries/:id/{publish,reject}` | 词条操作 |
| GET | `/api/v1/graph/clustered` | 聚类图 |
| GET | `/api/v1/graph/triplets` | 三元组 |

### 6.6 搜索

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/search` | 通用搜索(混合) |
| GET | `/api/v1/v2/search` | v2 搜索 |
| GET | `/api/v1/deep-search` | 深度搜索 |
| GET | `/api/v1/session/context/:documentId` | 会话上下文 |

### 6.7 LLM 配置

| Method | Path | 说明 |
|--------|------|------|
| GET/POST/PATCH | `/api/v1/llm-providers` | 提供商 |
| GET/POST/PATCH | `/api/v1/llm-models` | 模型 |
| GET | `/api/v1/workspace` | 工作区 |
| GET | `/api/v1/workspace/models` | 工作区模型 |

### 6.8 杂项

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/memory/delete-range` | 范围删除 |
| POST | `/api/v1/chat/session/create` | session |

## 7. 前端页面(Vue)

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `HomeDashboardView` | 首页仪表盘 |
| `/login` | `LoginView` | 登录 |
| `/chat` | `SimpleChatView` | 简单聊天(分页/搜索) |
| `/conversations/new` | `ConversationCreateView` | 新建对话 |
| `/conversations/:id` | `ConversationView` | 对话详情 |
| `/documents/:id` | `DocumentReaderView` | 文档阅读 |
| `/home/memory/documents` | `MemoryDocumentsView` | 记忆文档(对话+文档合并) |
| `/home/memory/graph` | `MemoryGraphView` | 记忆图谱 |
| `/home/memory/labels` | `MemoryLabelsView` | 标签管理 |
| `/home/memory/keywords` | `KeywordTagsView` | 关键词云 |
| `/home/knowledge/inbox` | `KnowledgeInboxView` | 学习收件箱 |
| `/home/knowledge/objects/:id` | `KnowledgeObjectView` | 对象详情 |
| `/home/wiki` | `WikiListView` | 词条列表 |
| `/home/wiki/:id` | `WikiEntryView` | 词条详情 |
| `/home/settings/models` | `SettingsModelsView` | 模型设置 |

## 8. 业务服务层(9000+ 行)

| 文件 | 行数 | 职责 |
|------|------|------|
| `knowledge-capture.server.ts` | 1871 | 知识抽取(对话→候选实体/关系) |
| `knowledgeGraph.server.ts` | 960 | 知识图谱写入(Neo4j) |
| `search.server.ts` | 940 | 通用搜索(向量+全文+图谱) |
| `llm-provider.server.ts` | 687 | LLM 提供商管理 |
| `episodeChunker.server.ts` | 656 | Episode 切片 |
| `vectorStorage.server.ts` | 522 | 向量存储 |
| `conversation.server.ts` | 509 | 对话业务 |
| `wikiEntry.server.ts` | 410 | 词条管理 |
| `byok.server.ts` | 353 | BYOK 密钥 |
| `document.server.ts` | 351 | 文档业务 |
| `user-context.server.ts` | 257 | 用户上下文 |
| `label.server.ts` | 215 | 标签 |
| `episodeDiffer.server.ts` | 201 | Episode 差异 |
| `llm-config.server.ts` | 161 | LLM 配置 |
| `episodeVersioning.server.ts` | 137 | 版本 |
| `integrationAccount.server.ts` | 82 | 集成账号 |
| `session.server.ts` | 69 | 会话 |
| `ingestionLogs.server.ts` | 54 | 摄入日志 |

### 8.1 Agent 子目录

```
services/agent/
├── core-agent.ts        # Agent 核心
├── orchestrator-tools.ts # 工具编排
├── context.ts           # 上下文构建
├── context-window.ts    # 上下文窗口管理
├── memory.ts            # 记忆
├── message-processor.ts # 消息处理
├── mastra.ts            # Mastra 适配
├── mastra-stream.server.ts # 流式
├── agents/              # 各 Agent 实现
├── explorers.ts         # 探索器
├── executors/           # 执行器
├── prompts/             # Prompt 模板
├── tool-args-patch-processor.ts
├── tools/               # 工具
└── types/               # 类型
```

### 8.2 Prompt 模板(`services/prompts/`)

- `aspect-resolution.ts`
- `classify-voice.ts` / `classify-world.ts`
- `combined-extraction.ts`
- `extract-voice.ts` / `extract-world.ts`
- `reflect-voice.ts` / `reflect-world.ts`
- `nodes.ts` / `normalize.ts` / `statements.ts`
- `wiki-entry.ts`

## 9. 数据流

### 9.1 对话→知识→词条

```
Conversation (用户 + AI)
       ↓
KnowledgeCaptureBatch
       ↓
KnowledgeCaptureItem (PROPOSED: ENTITY/RELATION/EVENT/DECISION)
       ↓  (用户接受/合并)
WikiEntry (+ WikiEntryVersion)
       ↓
Neo4j 节点/边 + EntityEmbedding 向量
```

### 9.2 文档→知识

```
Document (upload/import/api)
       ↓
IngestionQueue (rule 匹配)
       ↓
Document chunks → pgvector 向量
       ↓
Label 关联
```

## 10. 配置

### 10.1 关键环境变量(`.env`)

```bash
# PostgreSQL
DB_HOST=localhost
DB_PORT=5433
POSTGRES_USER=docker
POSTGRES_DB=memorynote
DIRECT_URL=${DATABASE_URL}

# App
REMIX_APP_PORT=3033
APP_ENV=production
APP_ORIGIN=http://localhost:3033

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j

# LLM
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL=gpt-5.2
CHAT_PROVIDER=openai
```

完整列表见 `turbo.json` 的 `globalEnv` 段。

## 11. 本地开发

```bash
# 1. 启动基础设施
docker compose -f docker-compose.dev.yaml up -d

# 2. 安装依赖
pnpm install

# 3. 准备环境
cp .env.example .env  # 填入 LLM Key

# 4. 迁移数据库
pnpm db:migrate

# 5. 启动后端(3033)
pnpm --filter webapp dev

# 6. 启动前端(4173)
pnpm --filter web-vue dev
```

## 12. 统计(快照时点)

| 维度 | 数量 |
|------|------|
| API 路由 | 60+ |
| 前端页面 | 15 |
| 数据库 model | 25 |
| 业务服务文件 | 30+ |
| 业务代码行(后端 services) | 9000+ |
| 路由代码总行 | ~13000 |
| 数据库迁移 | 11 |
| 已有的对话数据 | 1742 条 deepseek-export |
| 已有的文档数据 | 160 条 upload |

## 13. 文档索引

- [ARCHITECTURE.md](./ARCHITECTURE.md) ← 本文档
- [KNOWN-ISSUES.md](./KNOWN-ISSUES.md) — 已知问题
- [MIGRATION-TO-V2.md](./MIGRATION-TO-V2.md) — v1→v2 迁移说明
- [../architecture-closed-loop.md](../architecture-closed-loop.md) — 早期架构闭环文档
- [../PROJECT_HANDOVER.md](../PROJECT_HANDOVER.md) — 项目交接
- [../PROJECT_TAKEOVER.md](../PROJECT_TAKEOVER.md) — 项目接管
