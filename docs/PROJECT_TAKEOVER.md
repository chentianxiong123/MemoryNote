# MemoryNote 项目接管文档

> 本文档为 AI 接管项目提供完整的技术背景和操作指南。阅读本文档后，AI 应能够理解项目架构、定位代码位置、进行功能开发和问题排查。

---

## 一、项目概述

### 1.1 项目定位

MemoryNote 是一个**面向个人长期知识增长的 AI 对话与知识库工作台**。它把日常和 AI 的对话、笔记、文档片段沉淀为可确认、可追溯、可关联的个人百科词条。

### 1.2 核心价值主张

```
AI 对话 / 笔记 / 文档
        ↓
会话 recap 与候选知识
        ↓
学习收件箱人工确认
        ↓
个人百科词条
        ↓
对象详情、证据、时间线、局部关系图
```

**关键设计决策**：
- 对话是主入口，知识沉淀发生在对话之后
- 词条解释必须是 AI 草稿加用户确认
- 笔记和文档是证据层，不是首页主知识对象
- 图谱只做对象详情里的局部图，不做全量渲染

### 1.3 项目版本

- 当前版本：`0.7.3`
- 包管理器：`pnpm@9.0.0`
- Node.js 要求：`>=20.0.0`

---

## 二、技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        MemoryNote 架构                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   web-vue       │    │    webapp       │                    │
│  │   (前端)        │◄──►│   (后端 API)    │                    │
│  │   Vue 3         │    │   Remix/Express │                    │
│  │   Vite          │    │   TypeScript    │                    │
│  │   Port: 4173    │    │   Port: 3033    │                    │
│  └─────────────────┘    └────────┬────────┘                    │
│                                  │                              │
│  ┌───────────────────────────────┼──────────────────────────┐  │
│  │           Packages            │                          │  │
│  │  ┌─────────────┐ ┌────────────┴──────────┐ ┌───────────┐ │  │
│  │  │  database   │ │      providers        │ │   types   │ │  │
│  │  │  Prisma     │ │  Neo4j / pgvector     │ │  共享类型  │ │  │
│  │  │  PostgreSQL │ │  Qdrant / Turbopuffer │ │           │ │  │
│  │  └─────────────┘ └───────────────────────┘ └───────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    基础设施 (Docker)                       │  │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │  │
│  │  │ PostgreSQL│ │   Neo4j   │ │   Redis   │ │  pgvector │ │  │
│  │  │  :5432    │ │  :7687    │ │  :6380    │ │  (内置)   │ │  │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈清单

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **前端** | Vue 3 | ^3.5.13 | 主前端框架 |
| | Vue Router | ^4.5.1 | 路由管理 |
| | Pinia | ^2.3.1 | 状态管理 |
| | Vite | ^6.3.5 | 构建工具 |
| | Sigma | ^3.0.2 | 图谱可视化 |
| | Graphology | ^0.26.0 | 图数据结构 |
| **后端** | Express | ^4.18.1 | Web 服务器 |
| | Remix | 2.17.4 | API 路由框架 |
| | TypeScript | 5.8.3 | 类型系统 |
| | Zod | 4.3.6 | 数据验证 |
| **AI/LLM** | AI SDK | 6.0.72 | LLM 调用封装 |
| | OpenAI SDK | ^6.21.0 | OpenAI 接口 |
| | Anthropic SDK | ^0.74.0 | Claude 接口 |
| | Mastra | ^1.6.0 | AI Agent 框架 |
| **数据库** | PostgreSQL | 18 + pgvector | 主数据库 + 向量存储 |
| | Neo4j | 5.x | 知识图谱存储 |
| | Prisma | * | ORM |
| | Redis | 7 | 缓存（非必需） |
| **工具** | pnpm | 9.0.0 | 包管理器 |
| | Turbo | ^2.5.3 | Monorepo 构建 |
| | Docker Compose | - | 本地开发环境 |

### 2.3 目录结构

```
MemoryNote/
├── apps/
│   ├── web-vue/              # Vue 前端（主前端）
│   │   ├── src/
│   │   │   ├── views/        # 页面组件
│   │   │   ├── components/   # 通用组件
│   │   │   ├── lib/          # API 客户端
│   │   │   ├── stores/       # Pinia 状态
│   │   │   └── router.ts     # 路由配置
│   │   └── package.json
│   │
│   └── webapp/               # Remix 后端
│       ├── app/
│       │   ├── routes/       # API 路由
│       │   ├── services/     # 业务服务
│       │   ├── models/       # 数据模型
│       │   └── lib/          # 工具函数
│       ├── prisma/           # 数据库迁移
│       └── package.json
│
├── packages/
│   ├── database/             # Prisma 数据库包
│   │   └── prisma/
│   │       └── schema.prisma # 数据模型定义
│   │
│   ├── providers/            # 提供商封装
│   │   └── src/
│   │       ├── graph/        # Neo4j 图数据库
│   │       ├── model/        # LLM 模型
│   │       └── vector/       # 向量存储
│   │
│   └── types/                # 共享类型
│       └── src/
│           └── graph/        # 图谱类型定义
│
├── docker-compose.dev.yaml   # 本地开发环境
├── pnpm-workspace.yaml       # Monorepo 配置
└── turbo.json                # 构建配置
```

---

## 三、核心功能模块

### 3.1 功能模块清单

| 模块 | 描述 | 前端页面 | 后端服务 |
|------|------|----------|----------|
| **AI 对话** | 与 AI 进行对话交互 | ConversationView | conversation.server.ts |
| **知识入库** | 将对话/文档转化为知识 | - | knowledgeGraph.server.ts |
| **学习收件箱** | 用户确认候选知识 | KnowledgeInboxView | knowledge-capture.server.ts |
| **知识对象** | 查看实体详情和关系图 | KnowledgeObjectView | - |
| **Wiki 词条** | 百科词条浏览和详情 | WikiListView, WikiEntryView | wikiEntry.server.ts |
| **文档管理** | 上传和管理文档 | MemoryDocumentsView | document.server.ts |
| **标签管理** | 管理知识标签 | MemoryLabelsView | label.server.ts |
| **模型配置** | 配置 LLM 模型 | SettingsModelsView | llm-provider.server.ts |
| **语义搜索** | 向量检索和 Rerank | - | search.server.ts |

### 3.2 核心业务流程

#### 3.2.1 知识入库流程

```
用户对话/文档上传
       ↓
Episode 创建 (episode.ts)
       ↓
内容标准化 (normalizePrompt)
       ↓
知识提取 (comprehendAndClassify)
  ├── Voice Aspects (用户偏好/规则)
  └── Graph Triples (实体关系)
       ↓
存储到 Neo4j (saveTriple)
       ↓
生成向量嵌入 (vectorStorage.server.ts)
       ↓
生成 Wiki 词条 (wikiEntry.server.ts)
```

**关键文件**：
- `apps/webapp/app/services/knowledgeGraph.server.ts` - 核心入库逻辑
- `apps/webapp/app/services/prompts/*.ts` - LLM Prompt 定义

#### 3.2.2 知识检索流程

```
用户查询
    ↓
向量嵌入 (getEmbedding)
    ↓
向量搜索 (searchEpisodesByEmbedding)
    ↓
Rerank 重排序 (可选)
    ↓
返回相关结果
```

**关键文件**：
- `apps/webapp/app/services/search.server.ts`
- `apps/webapp/app/services/search-v2/`

---

## 四、数据模型设计

### 4.1 核心数据表

#### PostgreSQL 表（Prisma 管理）

| 表名 | 描述 | 关键字段 |
|------|------|----------|
| `User` | 用户信息 | id, email, displayName |
| `Workspace` | 工作空间 | id, name, slug |
| `Conversation` | 对话记录 | id, title, userId |
| `ConversationHistory` | 对话消息 | id, message, parts |
| `Document` | 文档 | id, title, content, sessionId |
| `IngestionQueue` | 入队队列 | id, data, status |
| `Label` | 标签 | id, name, color |
| `KnowledgeCaptureBatch` | 知识捕获批次 | id, summary, status |
| `KnowledgeCaptureItem` | 知识捕获项 | id, kind, payload |
| `WikiEntry` | Wiki 词条 | id, entityUuid, title, definition |
| `WikiEntryVersion` | 词条版本 | id, wikiEntryId, version |
| `LLMProvider` | LLM 提供商 | id, name, type, config |
| `LLMModel` | LLM 模型 | id, modelId, capabilities |

#### Neo4j 节点类型

| 节点类型 | 描述 | 关键属性 |
|----------|------|----------|
| `Entity` | 实体节点 | uuid, name, type |
| `Statement` | 陈述节点 | uuid, fact, aspect |
| `Episode` | 事件节点 | uuid, content, source |
| `Predicate` | 谓词节点 | uuid, name |

**实体类型 (EntityTypes)**：
```typescript
const EntityTypes = [
  "Person",        // 人物
  "Organization",  // 组织
  "Place",         // 地点
  "Event",         // 事件
  "Project",       // 项目
  "Task",          // 任务
  "Technology",    // 技术
  "Product",       // 产品
  "Standard",      // 标准
  "Concept",       // 概念
  "Predicate",     // 谓词
];
```

### 4.2 数据模型文件位置

- **Prisma Schema**: `packages/database/prisma/schema.prisma`
- **类型定义**: `packages/types/src/graph/graph.entity.ts`
- **Neo4j 查询**: `packages/providers/src/graph/neo4j/`

---

## 五、API 接口清单

### 5.1 对话相关

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/conversation/create` | 创建新对话 |
| POST | `/api/v1/conversation/reply` | 发送消息并获取回复 |
| GET | `/api/v1/conversation/:conversationId` | 获取对话详情 |
| GET | `/api/v1/conversations` | 获取对话列表 |

### 5.2 知识图谱相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/graph/clustered` | 获取聚类图谱 |
| GET | `/api/v1/graph/triplets` | 获取知识三元组 |

### 5.3 知识对象相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/knowledge/home` | 获取知识工作台首页 |
| GET | `/api/v1/knowledge/inbox` | 获取学习收件箱 |
| POST | `/api/v1/knowledge/inbox/:itemId/accept` | 接受知识项 |
| POST | `/api/v1/knowledge/inbox/:itemId/reject` | 拒绝知识项 |
| GET | `/api/v1/knowledge/objects/:objectId` | 获取知识对象详情 |
| GET | `/api/v1/knowledge/objects/:objectId/graph` | 获取对象关系图 |
| GET | `/api/v1/knowledge/search` | 搜索知识对象 |

### 5.4 Wiki 词条相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/wiki/entries` | 获取词条列表 |
| GET | `/api/v1/wiki/entries/:entityUuid` | 获取词条详情 |
| GET | `/api/v1/wiki/entries/:entityUuid/versions` | 获取版本历史 |
| GET | `/api/v1/wiki/entries/:entityUuid/timeline` | 获取时间线 |

### 5.5 文档相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/documents` | 获取文档列表 |
| POST | `/api/v1/documents` | 上传文档 |
| GET | `/api/v1/documents/search` | 搜索文档 |

### 5.6 配置相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/v1/workspace` | 获取工作空间信息 |
| GET | `/api/v1/workspace/models` | 获取模型配置 |
| PUT | `/api/v1/workspace/models` | 更新模型配置 |
| GET | `/api/v1/llm-providers` | 获取 LLM 提供商列表 |
| GET | `/api/v1/llm-models` | 获取 LLM 模型列表 |

---

## 六、前端页面清单

### 6.1 页面路由

| 路由 | 页面组件 | 描述 |
|------|----------|------|
| `/home/conversation` | ConversationView | AI 对话页 |
| `/home/conversation/:id` | ConversationView | 对话详情 |
| `/home/memory/documents` | MemoryDocumentsView | 文档管理 |
| `/home/memory/graph` | MemoryGraphView | 知识工作台首页 |
| `/home/memory/graph/inbox` | KnowledgeInboxView | 学习收件箱 |
| `/home/memory/graph/object/:id` | KnowledgeObjectView | 知识对象详情 |
| `/home/memory/labels` | MemoryLabelsView | 标签管理 |
| `/home/wiki` | WikiListView | Wiki 词条列表 |
| `/home/wiki/:entityUuid` | WikiEntryView | Wiki 词条详情 |
| `/settings/workspace/models` | SettingsModelsView | 模型配置 |

### 6.2 前端文件位置

- **页面组件**: `apps/web-vue/src/views/`
- **通用组件**: `apps/web-vue/src/components/`
- **API 客户端**: `apps/web-vue/src/lib/api.ts`
- **路由配置**: `apps/web-vue/src/router.ts`
- **状态管理**: `apps/web-vue/src/stores/`

---

## 七、核心服务说明

### 7.1 后端服务清单

| 服务文件 | 职责 |
|----------|------|
| `knowledgeGraph.server.ts` | 知识图谱核心：入库、提取、存储 |
| `wikiEntry.server.ts` | Wiki 词条：创建、更新、查询 |
| `knowledge-capture.server.ts` | 知识捕获：候选知识管理 |
| `conversation.server.ts` | 对话管理：消息处理、流式响应 |
| `document.server.ts` | 文档管理：上传、解析、入库 |
| `search.server.ts` | 语义搜索：向量检索、Rerank |
| `vectorStorage.server.ts` | 向量存储：嵌入生成、存储 |
| `llm-provider.server.ts` | LLM 提供商：模型调用、配置 |
| `label.server.ts` | 标签管理：CRUD 操作 |
| `aspectStore.server.ts` | Voice Aspects 存储 |

### 7.2 Prompt 服务

| 文件 | 用途 |
|------|------|
| `prompts/extract-world.ts` | 提取世界知识（实体、关系） |
| `prompts/extract-voice.ts` | 提取用户声音（偏好、规则） |
| `prompts/classify-world.ts` | 分类世界知识 |
| `prompts/classify-voice.ts` | 分类用户声音 |
| `prompts/reflect-world.ts` | 反思世界知识（过滤噪声） |
| `prompts/reflect-voice.ts` | 反思用户声音 |
| `prompts/normalize.ts` | 标准化内容 |
| `prompts/wiki-entry.ts` | 生成 Wiki 词条内容 |

### 7.3 图数据库服务

| 文件 | 职责 |
|------|------|
| `graphModels/entity.ts` | 实体节点操作 |
| `graphModels/statement.ts` | 陈述节点操作 |
| `graphModels/episode.ts` | 事件节点操作 |
| `graphModels/triple.ts` | 三元组操作 |

---

## 八、开发环境搭建

### 8.1 环境要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose

### 8.2 快速启动

```bash
# 1. 启动基础设施
docker compose -f docker-compose.dev.yaml up -d

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置必要的 API Key

# 4. 运行数据库迁移
pnpm db:migrate

# 5. 启动后端
pnpm --filter webapp dev

# 6. 启动前端（新终端）
pnpm --filter web-vue dev
```

### 8.3 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:4173 |
| 后端 API | http://localhost:3033 |
| PostgreSQL | localhost:5432 |
| Neo4j Browser | http://localhost:7474 |
| Neo4j Bolt | bolt://localhost:7687 |
| Redis | localhost:6380 |

### 8.4 常用命令

```bash
# 开发
pnpm --filter webapp dev          # 启动后端
pnpm --filter web-vue dev         # 启动前端

# 构建
pnpm --filter web-vue build       # 构建前端
pnpm build                        # 构建所有

# 类型检查
pnpm --filter webapp typecheck    # 后端类型检查
pnpm --filter web-vue typecheck   # 前端类型检查

# 数据库
pnpm db:migrate                   # 运行迁移
pnpm db:migrate:create            # 创建迁移
pnpm db:studio                    # 打开 Prisma Studio

# 代码质量
pnpm lint                         # 代码检查
pnpm format                       # 代码格式化
```

---

## 九、配置说明

### 9.1 必需配置

```env
# 数据库
DATABASE_URL=postgresql://docker:docker@localhost:5432/memorynote?schema=memorynote

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=docker1234

# LLM（至少配置一个）
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_MODE=responses
MODEL=gpt-4o

# 安全
SESSION_SECRET=your-session-secret
ENCRYPTION_KEY=your-encryption-key
```

### 9.2 模型配置推荐

```env
# OpenAI 兼容接口（推荐）
CHAT_PROVIDER=openai
OPENAI_API_MODE=chat_completions
OPENAI_BASE_URL=https://api.your-provider.com
MODEL=deepseek-v4-flash

# Embedding
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_MODEL_SIZE=1536

# Rerank（可选）
RERANK_PROVIDER=openai
RERANK_MODEL=qwen3-reranker-8b
```

---

## 十、常见问题与解决方案

### 10.1 启动问题

**问题：数据库连接失败**
```bash
# 检查 Docker 容器状态
docker ps

# 重启数据库
docker compose -f docker-compose.dev.yaml restart postgres
```

**问题：Neo4j 连接失败**
```bash
# 检查 Neo4j 状态
docker compose -f docker-compose.dev.yaml logs neo4j

# 等待 Neo4j 完全启动（约 20 秒）
```

### 10.2 功能问题

**问题：对话无响应**
- 检查 LLM API Key 是否正确
- 检查 `OPENAI_BASE_URL` 是否可达
- 查看后端日志：`apps/webapp/app/services/logger.service.ts`

**问题：知识不入库**
- 检查 Neo4j 连接
- 查看 `knowledgeGraph.server.ts` 日志
- 确认 `addEpisode` 方法执行成功

**问题：向量搜索无结果**
- 检查 embedding 模型配置
- 确认 `EMBEDDING_MODEL` 和 `EMBEDDING_MODEL_SIZE` 匹配
- 查看 `vectorStorage.server.ts` 日志

### 10.3 类型错误

**问题：Prisma 类型不同步**
```bash
# 重新生成 Prisma 客户端
pnpm --filter database generate
```

**问题：前端类型错误**
```bash
# 运行类型检查
pnpm --filter web-vue typecheck
```

---

## 十一、接管指南

### 11.1 接管前检查清单

- [ ] 确认 Node.js 版本 >= 20
- [ ] 确认 pnpm 版本 >= 9
- [ ] Docker 服务正常运行
- [ ] PostgreSQL、Neo4j、Redis 容器正常
- [ ] `.env` 文件配置完整
- [ ] 数据库迁移已执行

### 11.2 代码定位指南

| 需求 | 文件位置 |
|------|----------|
| 修改知识入库逻辑 | `apps/webapp/app/services/knowledgeGraph.server.ts` |
| 添加新的 Prompt | `apps/webapp/app/services/prompts/` |
| 修改 API 接口 | `apps/webapp/app/routes/api.v1.*.tsx` |
| 添加前端页面 | `apps/web-vue/src/views/` |
| 修改数据模型 | `packages/database/prisma/schema.prisma` |
| 添加图谱查询 | `packages/providers/src/graph/neo4j/` |
| 修改类型定义 | `packages/types/src/graph/graph.entity.ts` |

### 11.3 开发流程建议

1. **理解需求** → 阅读本文档相关章节
2. **定位代码** → 使用代码定位指南
3. **编写代码** → 遵循现有代码风格
4. **类型检查** → `pnpm check-types`
5. **本地测试** → 启动服务验证功能
6. **代码格式化** → `pnpm format`

### 11.4 注意事项

1. **不要提交 `.env` 文件**
2. **不要提交 API Key**
3. **数据库迁移需要谨慎**：先备份，再迁移
4. **Neo4j 查询优化**：避免全量扫描，使用索引
5. **LLM 调用成本**：使用 `low` 复杂度模型进行非关键操作

---

## 十二、项目演进历史

### 12.1 已完成的功能

- [x] Vue 前端主方向切换
- [x] 知识图谱三元组存储
- [x] 学习收件箱机制
- [x] Wiki 词条系统
- [x] 模型配置页面
- [x] 向量检索集成
- [x] 文档版本管理

### 12.2 待完善的功能

- [ ] 对话自动抽取知识入图（部分完成）
- [ ] 词条内容的增量更新优化
- [ ] 图谱可视化性能优化
- [ ] 移动端适配

### 12.3 已移除的功能

- Redis/BullMQ 强依赖（已降级为可选）
- 企业级集成功能
- 多用户协作功能
- React/Remix UI（保留后端 API）

---

## 附录：关键文件索引

### A. 后端核心文件

```
apps/webapp/app/
├── server.ts                          # 入口文件
├── db.server.ts                       # 数据库连接
├── services/
│   ├── knowledgeGraph.server.ts       # 知识图谱核心
│   ├── wikiEntry.server.ts            # Wiki 词条服务
│   ├── conversation.server.ts         # 对话服务
│   ├── search.server.ts               # 搜索服务
│   ├── vectorStorage.server.ts        # 向量存储
│   └── llm-provider.server.ts         # LLM 提供商
├── routes/
│   ├── api.v1.conversation.*.tsx      # 对话 API
│   ├── api.v1.knowledge.*.tsx         # 知识 API
│   ├── api.v1.wiki.*.tsx              # Wiki API
│   └── api.v1.graph.*.tsx             # 图谱 API
└── lib/
    └── model.server.ts                # LLM 调用封装
```

### B. 前端核心文件

```
apps/web-vue/src/
├── main.ts                            # 入口文件
├── router.ts                          # 路由配置
├── lib/
│   └── api.ts                         # API 客户端
├── views/
│   ├── ConversationView.vue           # 对话页
│   ├── KnowledgeObjectView.vue        # 知识对象详情
│   ├── WikiListView.vue               # Wiki 列表
│   └── WikiEntryView.vue              # Wiki 详情
└── components/
    ├── GraphLocalView.vue             # 局部图谱组件
    └── AppShell.vue                   # 应用外壳
```

### C. 共享包文件

```
packages/
├── database/prisma/
│   └── schema.prisma                  # 数据模型定义
├── types/src/
│   └── graph/graph.entity.ts          # 类型定义
└── providers/src/
    ├── graph/neo4j/                   # Neo4j 操作
    ├── model/                         # LLM 模型封装
    └── vector/                        # 向量存储封装
```

---

**文档版本**: 1.0.0
**最后更新**: 2026-05-05
**维护者**: MemoryNote Team
