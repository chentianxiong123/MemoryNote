# MemoryNote

MemoryNote 是一个面向个人长期知识增长的 AI 对话与知识库工作台。它把日常和 AI 的对话、笔记、文档片段沉淀为可确认、可追溯、可关联的个人百科词条。

当前版本的核心目标不是做一个炫技的全量知识图谱，而是建立一条更稳的个人知识链路：

```text
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

## 现在能做什么

- 对话优先：主工作区仍然是 AI 对话，知识沉淀发生在对话之后。
- 学习收件箱：AI 提取候选对象、关系、事件和决策，用户确认后才进入长期知识库。
- 百科式词条：每个术语、主题、项目、人物可以拥有短解释、别名、证据来源、时间信息和关系。
- 证据层：对话、笔记、文档、网页摘录不抢主对象位置，只作为词条和关系的来源证据。
- 局部图：图只出现在对象详情页，默认一跳邻居，避免首页全量渲染卡死。
- 模型配置：支持 OpenAI 兼容接口、embedding、rerank 等配置。

## 架构概览

- `apps/web-vue`：当前主要前端，包含对话、知识工作台、学习收件箱、对象详情和局部图。
- `apps/webapp`：Remix/Express 后端，负责 API、会话、知识捕获、图谱写入、模型调用。
- `packages/database`：Prisma 数据模型。
- `packages/providers`：Neo4j / pgvector 等底层 provider。
- `packages/types`：共享类型，包含底层图谱实体与 statement 类型。
- `docker-compose.dev.yaml`：本地开发依赖服务，包含 PostgreSQL、Redis、Neo4j。

## 本地开发

要求：

- Node.js 20+
- pnpm 9+
- Docker / Docker Compose

启动依赖服务：

```bash
docker compose -f docker-compose.dev.yaml up -d
```

安装依赖：

```bash
pnpm install
```

准备本地环境变量：

```bash
cp .env.example .env
```

至少配置一个可用的聊天模型 Key。支持 OpenAI 或 OpenAI-compatible endpoint：

```bash
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_MODE=responses
CHAT_PROVIDER=openai
MODEL=gpt-5.2
```

启动后端：

```bash
pnpm --filter webapp dev
```

启动前端：

```bash
pnpm --filter web-vue dev
```

默认访问：

- 前端：http://localhost:4173
- 后端：http://localhost:3033
- 知识工作台：http://localhost:4173/home/memory/graph

## 常用命令

```bash
pnpm --filter webapp typecheck
pnpm --filter web-vue typecheck
pnpm --filter web-vue build
pnpm db:migrate
pnpm generate
```

## 发布前注意

- 不要提交任何 `.env` 文件。
- 不要提交本地日志、临时交接文档、模型 API Key。
- 如果使用 OpenAI-compatible 代理，只把配置方式写进文档，不要提交真实 Key。
- 旧的全量图接口可以保留做兼容，但产品入口不应再依赖全量图渲染。

## 当前方向

MemoryNote 仍处于早期收口阶段。v1 的产品判断是：

- 对话是主入口，不把知识收件箱放在对话前面。
- 词条解释必须是 AI 草稿加用户确认，不直接把 LLM 输出写成长期事实。
- 笔记和文档是证据层，不是首页主知识对象。
- 3D 图谱不作为产品入口；2D 图谱只做对象详情里的局部图。

## 来源与协议

本项目基于开源项目 CORE 进行重构和个人知识库方向改造，保留原项目的协议约束。详见 [LICENSE](LICENSE)。
