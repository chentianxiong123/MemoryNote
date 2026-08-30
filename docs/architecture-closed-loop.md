# MemoryNote 全链路闭环架构文档

> 版本：v1.0 | 更新：2025-08-30

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          全链路闭环                                     │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  ① 数据输入   │    │  ② AI 处理   │    │  ③ 知识存储   │              │
│  │              │    │              │    │              │              │
│  │ 供应商 API    │───▶│ 文档切片     │───▶│ 向量 RAG     │              │
│  │ 对话聊天     │    │ 知识提取     │    │ pgvector     │              │
│  │ 手动提交文档  │    │ 总结压缩     │    │              │              │
│  └──────────────┘    │ 实体识别     │    │ 知识图谱     │              │
│                      │ (LLM调用)    │───▶│ Neo4j        │              │
│                      └──────────────┘    │              │              │
│                                          │ Wiki 结构化   │              │
│  ┌──────────────┐    ┌──────────────┐    │ 知识库       │              │
│  │  ④ 检索应用   │◀───│  ⑤ 人工审核   │    └──────────────┘              │
│  │              │    │              │              │                     │
│  │ 混合搜索      │    │ 学习收件箱   │              │                     │
│  │ (向量+全文+图谱)│   │ 批量处理     │    ┌──────────────┐              │
│  │              │    │ 接受/合并/拒绝│───▶│  ⑥ 统计仪表盘  │              │
│  └──────────────┘    └──────────────┘    │ 成长轨迹     │              │
│                                         │ 知识增长     │              │
│                                         └──────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 六大核心环节

### 2.1 ① 数据输入层

| 来源 | 处理方式 | 存储表 | API 端点 |
|------|---------|--------|---------|
| 供应商 API | Webhook/轮询 → 标准化 Document | `Document` | `/api/v1/documents` |
| 对话聊天 | 实时追加 → ConversationHistory | `Conversation` + `ConversationHistory` | `/api/v1/chat` |
| 手动提交文档 | 上传/粘贴 → 创建 Document | `Document` | `/api/v1/documents` (POST) |

**核心模型**：
```prisma
model Document {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deleted   DateTime?

  source    String   // 来源标识：chat/upload/api/whatsapp...
  type      String   // 类型：text/pdf/markdown/conversation...
  status    String   // pending/processing/completed/failed
  title     String?
  content   String   // 原始内容
  metadata  Json?    // 扩展字段

  sessionId String?  // 关联会话/批次
  labelIds  String[] // 标签

  @@index([source])
  @@index([status])
  @@index([sessionId])
}
```

---

### 2.2 ② AI 处理层

**处理管道**：
```
Document/Conversation
       │
       ▼
┌─────────────────────┐
│  EpisodeChunker     │  ← 智能切片（语义分段、重叠窗口）
└─────────┬───────────┘
          │ Chunks[]
          ▼
┌─────────────────────┐
│  KnowledgeCapture   │  ← LLM 结构化抽取（实体、关系、事件、决策、陈述）
│  - extractCombined  │
│  - batchStore       │
└─────────┬───────────┘
          │ KnowledgeCaptureItem[]
          ▼
    进入收件箱等待审核
```

**关键服务**：
- `episodeChunker.server.ts` — 语义切片、Token 控制
- `knowledge-capture.server.ts` — 核心提取逻辑，调用 `combined-extraction` prompt
- `synthesis-utils.ts` — 多源融合、去重、版本管理

**Prompt 策略** (`prompts/combined-extraction.ts`)：
```
单次 LLM 调用同时抽取：
├── 实体 - 概念/人物/工具/组织...
├── 关系 - is_a/part_of/uses/causes/decided_in...
├── 事件 - 发生时间、参与者、地点
├── 决策 - 决策内容、依据、决策人、状态
├── 陈述 - 观点/论据/事实陈述
└── 方面 - 语音/风格/语气特征
```

---

### 2.3 ③ 知识存储层

#### A. 向量检索 (pgvector)
```prisma
model EntityEmbedding {
  id        String   @id @default(uuid())
  entityUuid String  @unique
  vector    Unsupported("vector(1536)")  // OpenAI text-embedding-3-small
  metadata  Json?
}
```
**服务**：`vectorStorage.server.ts` — batchUpsert / similaritySearch / hybridSearch

#### B. 知识图谱
```prisma
// Neo4j 节点标签
(:Entity {uuid, name, type, definition})
(:Episode {uuid, content, type, timestamp})
(:Statement {uuid, fact, aspect})

// Neo4j 关系
(:Entity)-[:IS_A|PART_OF|USES|CAUSES|DECIDED_IN|LEARNED_FROM]->(:Entity)
(:Episode)-[:MENTIONS]->(:Entity)
(:Statement)-[:ABOUT]->(:Entity)
```
**服务**：`knowledgeGraph.server.ts` — upsertNode / upsertRelation / communityDetection

#### C. Wiki 结构化知识库
```prisma
model WikiEntry {
  id           String   @id @default(uuid())
  entityUuid   String   @unique
  title        String
  definition   String   @db.Text
  content      String   @db.Text  // Markdown
  status       String   // draft/published/rejected
  version      Int      @default(1)
  
  WikiEntryVersion[] versions
}
```
**服务**：`wikiEntry.server.ts` — create / publish / version / timeline

---

### 2.4 ④ 检索应用层

**混合搜索策略** (`search-v2/index.ts`)：
```
用户查询
    │
    ├─▶ 向量搜索 (pgvector) ──▶ 语义相似 Top-K
    ├─▶ 全文搜索 (PostgreSQL tsvector) ──▶ 关键词匹配 Top-K
    └─▶ 图谱搜索 (Neo4j) ──▶ 实体邻域扩展 Top-K
           │
           ▼
    RRF (Reciprocal Rank Fusion) 融合重排
           │
           ▼
    返回统一结果：Document / WikiEntry / Entity / Episode
```

**API**：`/api/v1/search` / `/api/v1/v2/search`

---

### 2.5 ⑤ 人工审核层 - 学习收件箱

**流程**：
```
KnowledgeCaptureItem (proposed)
       │
       ▼
┌──────────────────────────┐
│     学习收件箱            │
│  /home/memory/graph/inbox│
└──────────┬───────────────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
  接受    合并    拒绝
    │      │      │
    ▼      ▼      ▼
生成/    合并到   标记
更新     现有      rejected
实体      实体
```

**批量操作**：支持多选接受/合并/拒绝/延迟

---

### 2.6 ⑥ 统计仪表盘层

**首页数据源** (`api.v1.knowledge.home.tsx`)：
| 指标 | 来源 | 计算方式 |
|------|------|---------|
| 今日知识增长 | `KnowledgeCaptureItem` | `createdAt >= today AND status=accepted` |
| 待确认项 | `KnowledgeCaptureItem` | `status=proposed` |
| 实体总数 | `Entity` (Neo4j/pgvector) | `count(*)` |
| 文档总数 | `Document` | `count(*)` |
| 对话总数 | `Conversation` | `count(*)` |
| 学习趋势 | `KnowledgeCaptureItem` | 按天聚合 accepted/proposed |

---

## 3. 当前代码库实现状态

### ✅ 已完成（前端框架 + 基础设施）

| 模块 | 文件 | 状态 |
|------|------|------|
| 登录/认证 | `LoginView.vue`, `api.v1.login.tsx` | ✅ |
| 首页仪表盘 | `HomeDashboardView.vue` | ✅ UI 就绪 |
| 对话界面 | `SimpleChatView.vue` | ✅ UI 就绪 |
| 文档列表 | `MemoryDocumentsView.vue` | ✅ UI 就绪 |
| 知识图谱 | `MemoryGraphView.vue` + Sigma.js | ✅ UI 就绪 |
| 学习收件箱 | `KnowledgeInboxView.vue` | ✅ UI 就绪 |
| Wiki 列表/详情 | `WikiListView.vue` / `WikiEntryView.vue` | ✅ UI 就绪 |
| 侧边栏导航 | `AppShell.vue` | ✅ 可折叠、浮动描述 |

### ⚠️ 待清理（服务层仍引用已删除的多租户字段）

| 服务文件 | 问题字段 | 预估工作量 |
|---------|---------|-----------|
| `knowledge-capture.server.ts` | `userId`, `workspaceId` | 中 |
| `vectorStorage.server.ts` | `userId`, `workspaceId` | 中 |
| `knowledgeGraph.server.ts` | `workspaceId` | 中 |
| `wikiEntry.server.ts` | `userId`, `workspaceId` | 中 |
| `document.server.ts` | `workspaceId` | 小 |
| `conversation.server.ts` | `workspaceId` | 小 |
| `search-v2/` | 过滤条件 | 中 |
| 所有 API routes | 认证中间件 | 小 |

### ❌ 未实现（核心 AI 链路）

| 功能 | 描述 |
|------|------|
| 真实 LLM 调用 | 当前 `makeStructuredModelCall` 返回 mock，需接入 OpenAI/兼容 API |
| 对话结束自动摘要 | `Conversation` → 触发 `knowledge-capture` → 生成实体/关系 |
| 文档上传自动处理 | `Document` created → `IngestionQueue` → chunk → embed → extract |
| 实时向量化 | pgvector 批量写入、增量更新 |
| 图谱实时同步 | Neo4j 节点/关系增量 upsert |
| Wiki 自动生成 | 从 accepted CaptureItem 生成/更新 WikiEntry |

---

## 4. 数据流向详细设计

### 4.1 对话 → 知识闭环

```
用户发送消息
    │
    ▼
POST /api/v1/chat { conversationId, message }
    │
    ▼
conversation.server.ts:appendMessage()
    │
    ▼
[后台任务/异步] 判断是否触发摘要（轮数阈值/Token阈值/用户显式命令）
    │
    ▼
knowledge-capture.server.ts:processConversation()
    │
    ├─▶ 获取最近 N 轮对话
    ├─▶ 调用 LLM: combined-extraction
    ├─▶ 生成 KnowledgeCaptureBatch + Items
    └─▶ 写入收件箱 (status=proposed)
           │
           ▼
      前端收件箱显示
           │
      用户接受/合并
           │
           ▼
      更新 Entity/Relation/Statement → Neo4j + pgvector
           │
           ▼
      生成/更新 WikiEntry
```

### 4.2 文档 → 知识闭环

```
POST /api/v1/documents { source, type, title, content }
    │
    ▼
document.server.ts:createDocument()
    │
    ▼
创建 IngestionQueue 记录 (sessionId = document.id)
    │
    ▼
[Worker 进程] ingestion processor
    │
    ├─▶ episodeChunker: chunkDocument() → Episode[]
    ├─▶ 每个 Episode → knowledge-capture.extractCombined()
    ├─▶ 批量写入 KnowledgeCaptureBatch/Item
    ├─▶ vectorStorage.batchStoreEntityEmbeddings()
    ├─▶ knowledgeGraph.upsertNodes/Relations()
    └─▶ 标记 Document.status = completed
```

---

## 5. 数据库 Schema（个人版简化后）

```prisma
// 核心业务模型（24 个）
model Conversation { ... }
model ConversationHistory { ... }
model CompactedSessionEmbedding { ... }
model KnowledgeCaptureBatch { ... }
model KnowledgeCaptureItem { ... }
model Document { ... }
model EntityEmbedding { ... }
model LabelEmbedding { ... }
model EpisodeEmbedding { ... }
model IngestionQueue { ... }
model IngestionRule { ... }
model Label { ... }
model RecallLog { ... }
model Reminder { ... }
model StatementEmbedding { ... }
model VoiceAspect { ... }
model VoiceAspectEmbedding { ... }
model Task { ... }
model Page { ... }
model ButlerComment { ... }
model LLMProvider { ... }
model LLMModel { ... }
model WikiEntry { ... }
model WikiEntryVersion { ... }
```

> 已移除：User, Workspace, WorkspaceMember, IntegrationAccount 等 26 个多租户模型

---

## 6. 环境变量配置

```env
# 数据库
DATABASE_URL="postgresql://docker@localhost:5433/memorynote?schema=memorynote"
DIRECT_URL="postgresql://docker@localhost:5433/memorynote?schema=memorynote"

# Neo4j
NEO4J_URI="neo4j://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="password"

# 向量提供商 (pgvector/qdrant/turbopuffer)
VECTOR_PROVIDER="pgvector"

# LLM (待配置)
OPENAI_API_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"
DEFAULT_CHAT_MODEL="gpt-4o-mini"
DEFAULT_EMBEDDING_MODEL="text-embedding-3-small"

# 应用
APP_PASSWORD="8888"  # 前端硬编码验证
```

---

## 7. 待办清单（按优先级）

### P0 - 基础清理（阻塞后续）
- [ ] 清理 `knowledge-capture.server.ts` 多租户引用
- [ ] 清理 `vectorStorage.server.ts` 多租户引用
- [ ] 清理 `knowledgeGraph.server.ts` 多租户引用
- [ ] 清理 `wikiEntry.server.ts` 多租户引用
- [ ] 统一 API 认证为简单 token（localStorage）

### P1 - 打通 AI 核心链路
- [ ] 配置 `OPENAI_API_KEY`，验证 `makeStructuredModelCall` 真实调用
- [ ] 实现 `Conversation` 结束触发自动摘要+知识提取
- [ ] 实现 `Document` 创建触发 IngestionQueue 处理
- [ ] 验证 pgvector 写入/检索
- [ ] 验证 Neo4j 节点/关系写入

### P2 - 完善应用层
- [ ] 修复首页统计 API 返回真实数据
- [ ] 实现混合搜索（向量+全文+图谱）
- [ ] 收件箱批量操作联调
- [ ] Wiki 自动生成/更新联调

### P3 - 体验优化
- [ ] 对话流式输出
- [ ] 文档上传进度显示
- [ ] 知识图谱可视化交互优化
- [ ] 成长轨迹图表丰富

---

## 8. 关键文件索引

| 类别 | 关键文件 |
|------|---------|
| **前端页面** | `HomeDashboardView.vue`, `SimpleChatView.vue`, `MemoryDocumentsView.vue`, `MemoryGraphView.vue`, `KnowledgeInboxView.vue`, `WikiListView.vue`, `WikiEntryView.vue` |
| **前端组件** | `AppShell.vue`, `GraphLocalView.vue` |
| **API 路由** | `api.v1.chat.tsx`, `api.v1.documents.tsx`, `api.v1.knowledge.inbox.tsx`, `api.v1.wiki.entries.tsx`, `api.v1.graph.triplets.tsx`, `api.v1.search.tsx` |
| **服务层** | `knowledge-capture.server.ts`, `vectorStorage.server.ts`, `knowledgeGraph.server.ts`, `wikiEntry.server.ts`, `document.server.ts`, `conversation.server.ts`, `episodeChunker.server.ts` |
| **Prompt** | `prompts/combined-extraction.ts`, `prompts/wiki-entry.ts` |
| **搜索** | `search-v2/index.ts`, `search-v2/router.ts`, `search-v2/handlers.ts` |
| **数据库** | `packages/database/prisma/schema.prisma` |

---

*文档维护：随架构演进同步更新*