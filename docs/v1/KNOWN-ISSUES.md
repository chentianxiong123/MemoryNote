# MemoryNote v1 已知问题与未完成项

> v1 收尾时的快照。所有问题按"严重程度"和"是否在 v2 修复"分类。
> v2 启动时必须先看本文件,不要把 v1 的 bug 一起搬到 v2。

## 严重程度说明

- 🔴 **阻塞**:核心功能不可用
- 🟠 **功能缺陷**:能用但行为不对
- 🟡 **体验问题**:能用但难受
- 🔵 **技术债**:不影响功能但留坑

## A. 数据一致性问题

### A1. 🔴 默认文档总数显示不全
- **现象**: `MemoryDocumentsView` 顶部"文档总数"显示 `160`,实际应为 `1902`(160 Document + 1742 Conversation)。
- **原因**: `api.v1.documents.tsx` 无 `?source=` 参数时只查 `Document` 表。
- **修复状态**: v1 改了一半,后端启动时 API 返回空响应(curl JSON decode error),**未修复**。
- **v2 方案**: 直查 `prisma.conversation.count() + prisma.document.count()`,前端用 RSC 一次渲染,不再走"分页合并"。

### A2. 🟠 `document_fts` 中文不分词
- **现象**: 中文全文搜索匹配整句,基本无效。
- **原因**: `to_tsvector('simple', ...)` 不分词。
- **修复状态**: 已知未修。
- **v2 方案**: 用 `pg_trgm` + `jieba` 字典,或干脆改成客户端搜索。

### A3. 🟡 `Conversation.source` 字段值混乱
- **现象**: 历史数据中 `source` 出现过 `core` / `deepseek-export` / `对话` / `对话文档` / `upload` 等。
- **原因**: 多轮需求变更+临时导入脚本。
- **v2 方案**: 统一枚举,加 `CHECK` 约束,启动时数据迁移脚本把脏数据清洗。

### A4. 🟡 `document_fts` 视图被改成 `LEFT(content, 500000)` 截断
- **现象**: 长对话内容超过 50 万字符会被截断后建索引。
- **原因**: 为了支持已删除的"对话文档"中间表(已删除)。
- **v2 方案**: 既然不再存对话到 Document,视图回滚为原样,或干脆删掉。

## B. 后端架构问题

### B1. 🟠 `apps/webapp` 双层结构冗余
- **现象**: Remix 文件式路由 + `routeLoader.ts` 手动 mount,Remix 的 SSR/loader 能力完全没用上,只是借它的文件夹约定组织 Express 路由。
- **影响**: 6000+ 行 Remix 模板代码(`@remix-run/*`)实际是死代码,徒增依赖和心智负担。
- **v2 方案**: 删 `webapp`,用 Next.js App Router 原生 server actions / route handlers。

### B2. 🔵 `tsx watch` 经常假死
- **现象**: 改文件后 watch 进程不重启,API 返回旧代码。
- **解决**: 必须 `pkill -f "tsx watch"` 后再启动,启动时间 ~5s。
- **v2 方案**: Next.js dev server 更稳,基本不存在此问题。

### B3. 🟡 端口 3033 经常被旧进程占用
- **现象**: `pkill` 后端口未立即释放,新进程 `EADDRINUSE`。
- **解决**: `pkill -9 -f "tsx watch"; sleep 2; ss -tlnp | grep 3033` 确认。
- **v2 方案**: 用 `dotenv` 读 `PORT`,环境变量可控。

### B4. 🟠 `services/` 30+ 文件 9000+ 行,无分层
- **现象**: `knowledge-capture.server.ts` 单文件 1871 行,`search.server.ts` 940 行。
- **v2 方案**: 抽 `packages/core` 包,按领域拆:`core/conversation.ts` / `core/document.ts` / `core/tag.ts` / `core/wiki.ts` / `core/knowledge.ts` / `core/search.ts`,每文件 < 400 行。

### B5. 🟡 `services/agent/` 高度耦合 Mastra
- **现象**: `knowledge-capture` 流程直接耦合 Mastra 1.36.0 API,版本升级困难。
- **v2 方案**: 抽象 `core/agent/`,把 Mastra 降级为可选 driver。

## C. 前端(Vue)问题

### C1. 🟠 Vue 3 + 双栈结构
- **现象**: `web-vue` 通过 `fetch` 调 `webapp` API,所有数据都走 JSON over HTTP。
- **影响**: 跨栈类型不安全;首页加载要等 6+ 个 API 返回;聊天流式响应要自己实现 SSE 客户端。
- **v2 方案**: Next.js + RSC 直接 import `core` 函数,零 HTTP 跳数。

### C2. 🟠 `MemoryDocumentsView` 缺预览列
- **现象**: 已删"内容预览"列,只显示标题和元数据,信息密度低。
- **原因**: 对话无 content,Document content 可能很长,统一处理麻烦。
- **v2 方案**: 用 `excerpt` 工具函数截前 80 字符,空内容显示占位符。

### C3. 🟡 图谱前端依赖 `sigma` + `graphology` 体积大
- **现象**: `graphology-layout-forceatlas2` ~200KB,首屏加载慢。
- **v2 方案**: 局部图改用 `react-force-graph` 或纯 SVG,只在对象详情页懒加载。

### C4. 🔵 Pinia store 缺乏类型
- **现象**: `stores/session.ts` 用 `any` 较多,IDE 提示差。
- **v2 方案**: Next.js + Server Component + Server Action,大部分场景不需要客户端 store。

## D. 数据库 / ORM 问题

### D1. 🟠 25 个 model 高度耦合
- **现象**: `Document` / `Conversation` / `Label` / `Task` / `Page` / `EpisodeEmbedding` / `StatementEmbedding` / `EntityEmbedding` 等之间的引用形成网状结构。
- **v2 方案**: 启动时做 model 审计,合并/拆分不合理的 model。优先级: 合并 `*Embedding` 为通用 `Embedding(modelType, modelId, vector)`。

### D2. 🟡 Prisma migration 历史混乱
- **现象**: 11 个 migration 里有 `20260403193833_add_butler_last_seen` 这种"管家"功能的迁移,跟当前方向不符。
- **v2 方案**: v2 启动时新建空 schema(只保留核心表),用 `prisma migrate diff` 生成初始 migration。数据走 ETL 脚本迁移。

### D3. 🟡 `@@index` 缺失
- **现象**: 多个高频查询字段没有索引,如 `ConversationHistory.conversationId`(实际上有 implicit index,但 `deleted` 过滤没建复合索引)。
- **v2 方案**: schema 评审时补齐。

### D4. 🟠 `BlockedKeyword` 表有外键但实际只是软过滤
- **现象**: 业务上"屏蔽词"是关键词云的过滤条件,不是强约束,加外键反而拖慢插入。
- **v2 方案**: 改成无外键的 `text[]` 字段或 Redis Set。

## E. 业务功能缺口

### E1. 🟠 移动端完全没做
- **现象**: 4173 端口的 Vue 只能在桌面浏览器用。
- **v2 方案**: 暂不在范围内,记录为 backlog。

### E2. 🟠 没有"导出全部数据"功能
- **现象**: 用户被锁在系统里,无法导出。
- **v2 方案**: v2 启动时第一批功能:导出对话 JSON、导出知识图谱 GraphML。

### E3. 🟡 没有"搜索历史"和"最近查看"
- **现象**: 用户常回头查的对话找不到入口。
- **v2 方案**: v1 已有 `RecallLog` 表,v2 复用。

### E4. 🟡 标签/关键词云只是词频,无时间衰减
- **现象**: 老的高频词一直占着顶部。
- **v2 方案**: 加时间衰减权重 `tfidf * exp(-Δt/τ)`。

## F. 安全/隐私

### F1. 🟠 `.env` 误提交风险
- **现象**: `.gitignore` 已含 `.env`,但历史上 commit 过真实 key。
- **v2 方案**: 启动时 `git log -p | grep -i "key\|secret"` 确认历史干净,`pre-commit` 装 `gitleaks`。

### F2. 🟡 API 无统一鉴权
- **现象**: 部分路由只在路由内部手动校验,容易漏。
- **v2 方案**: Next.js middleware + JWT。

### F3. 🟡 跨域宽松
- **现象**: CORS 全开(如有)。
- **v2 方案**: Next.js 内置 CORS 配白名单。

## G. 开发体验

### G1. 🟠 tsx watch + nodemon 冲突
- **现象**: 有时 `pnpm dev` 启动两个 watcher。
- **v2 方案**: Next.js dev server 自带。

### G2. 🟡 类型不严格
- **现象**: 大量 `any` 在 services 里。
- **v2 方案**: v2 启动第一天就开 `strict: true` + `noUncheckedIndexedAccess: true`。

### G3. 🟡 没有单测
- **现象**: 整个仓库无 `.test.ts` 文件。
- **v2 方案**: v2 核心函数加单测(对话/标签/搜索),覆盖率 > 60%。

## H. 文档/工程

### H1. 🟠 API 文档缺失
- **现象**: 60+ API 路由没 OpenAPI schema,前端靠口头约定。
- **v2 方案**: 用 `zod` 定义 schema,自动生成 OpenAPI。

### H2. 🟡 旧 `architecture-closed-loop.md` 描述跟代码脱节
- **现象**: 文档说"知识闭环 6 大环节",实际只跑通到第 3 步。
- **v2 方案**: v2 启动时重写。

### H3. 🔵 `nodejieba` 装在 root `package.json`
- **现象**: 根 `package.json` 依赖 `nodejieba`,但只有 webapp 偶尔用,应该下沉。
- **v2 方案**: 挪到 `apps/webapp` 或 `packages/nlp`(如果保留)。

## I. v2 必须解决的"硬指标"

| 指标 | v1 状态 | v2 目标 |
|------|---------|---------|
| 首屏可交互时间 | ~2.5s | < 1s |
| 主页 API 数 | 6+ | 0(走 RSC) |
| 业务代码总行 | 13000+ 路由 + 9000+ services | < 8000 |
| 启动后端到 200 OK | ~5s | < 2s |
| 类型覆盖率 | ~40% | > 90% |
| 单元测试覆盖率 | 0% | > 60% |
| 依赖(直接) | 80+ npm 包 | < 40 |
| 部署目标 | Docker compose | 单 Node 进程 / Vercel |
