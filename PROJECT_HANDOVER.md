# MemoryNote 项目接管说明

## 1. 项目目标

MemoryNote 最初基于 `CORE by RedPlanetHQ` 改造，但当前方向已经明确收敛为一个更简单的个人知识平台，重点不是保留 CORE 的全部能力，而是保留下面 4 件事：

1. 正常 AI 对话
2. 对话/笔记形成持久记忆
3. 基于向量的检索召回
4. 知识图谱入库与前端可视化

当前产品定位：

- 面向个人成长和专业知识管理
- 重点支持“和 AI 聊天 -> 抽取知识点 -> 写入图数据库 -> 在前端查看图谱”
- 人、物、技术概念、项目、任务都可以作为图谱实体

用户已经明确的取舍：

- 可以删除企业级集成、多用户协作、复杂工作流、Redis/BullMQ 强依赖等非核心内容
- 前端主方向改为 Vue，不再以 React/Remix UI 作为主交互层
- 知识图谱的“具象化展示”是第一优先级之一

---

## 2. 当前架构决策

### 2.1 保留的技术组件

- `PostgreSQL + Prisma`
  - 作为主业务数据存储
- `Neo4j`
  - 作为知识图谱存储
- `pgvector`
  - 作为向量检索基础
- `apps/webapp`
  - 继续作为后端 API 与部分旧服务承载层
- `apps/web-vue`
  - 作为新的主前端

### 2.2 已降级或移出关键路径的组件

- `Redis / BullMQ`
  - 已不再是系统启动和主流程的必需依赖
- 大量旧 CORE 集成、任务、自动化、企业功能
  - 已删除或不再作为当前主线继续维护

### 2.3 当前推荐的最小可用系统

如果只追求“个人知识平台”这条主线，最小闭环应该是：

1. Vue 前端能打开对话页
2. 用户能配置自己的模型接口
3. 用户能发消息并得到 AI 回复
4. 用户能手动或自动把知识三元组写入 Neo4j
5. 用户能在前端图谱页查看实体和关系
6. 用户能通过 embedding 做基础语义检索

---

## 3. 当前目录与职责

### 3.1 关键目录

```text
core/
├── apps/
│   ├── webapp/           # 旧 React/Remix 应用，目前主要承担后端 API 和服务层
│   ├── web-vue/          # 新 Vue 前端，当前主交互界面
│   └── tauri/            # 桌面端，当前不是主优先级
├── packages/
│   ├── providers/        # 模型/提供商封装
│   └── ...               # 其他共享包
└── PROJECT_HANDOVER.md   # 本交接文档
```

### 3.2 当前主用路由

Vue 前端当前主要页面：

- `/home/conversation`
- `/home/conversation/:conversationId`
- `/home/memory/documents`
- `/home/memory/graph`
- `/home/memory/labels`
- `/settings/workspace/models`

后端当前关键 API：

- `/api/v1/conversation/reply`
- `/api/v1/workspace/models`
- `/api/v1/graph/clustered`
- `/api/v1/graph/triplets`

---

## 4. 已完成的主要工作

## 4.1 前端主方向已切到 Vue

已新增 `apps/web-vue`，作为新的主前端。

当前已完成：

- 基础 Vue 应用可启动、可构建、可 typecheck
- 页面路由已切出知识平台主线
- 页面文案已改成中文方向
- 对话页、图谱页、模型设置页已重写

关键文件：

- [apps/web-vue/src/views/ConversationView.vue](/D:/files/MemoryNote/core/apps/web-vue/src/views/ConversationView.vue)
- [apps/web-vue/src/views/MemoryGraphView.vue](/D:/files/MemoryNote/core/apps/web-vue/src/views/MemoryGraphView.vue)
- [apps/web-vue/src/views/SettingsModelsView.vue](/D:/files/MemoryNote/core/apps/web-vue/src/views/SettingsModelsView.vue)
- [apps/web-vue/src/lib/api.ts](/D:/files/MemoryNote/core/apps/web-vue/src/lib/api.ts)

注意：

- 这几份文件当前内容整体是对的，但存在中文乱码问题，原因是编码混乱，不是页面结构问题
- 下一位接手者应优先把这些 Vue 文件统一保存为 UTF-8，并把乱码中文修正

## 4.2 知识图谱接口已从“会话聚类”转向“知识三元组”

旧 CORE 的图谱更偏会话/episode 聚类，不适合当前“个人知识体系搭建”目标。已做的改动：

- 重写图谱查询接口语义，开始按实体/关系输出
- 新增手动录入知识三元组接口
- Vue 图谱页已改成实体关系可视化，而不是旧式 session cluster 展示

关键文件：

- [apps/webapp/app/routes/api.v1.graph.clustered.tsx](/D:/files/MemoryNote/core/apps/webapp/app/routes/api.v1.graph.clustered.tsx)
- [apps/webapp/app/routes/api.v1.graph.triplets.tsx](/D:/files/MemoryNote/core/apps/webapp/app/routes/api.v1.graph.triplets.tsx)
- [apps/web-vue/src/views/MemoryGraphView.vue](/D:/files/MemoryNote/core/apps/web-vue/src/views/MemoryGraphView.vue)

当前能力：

- 可以手动输入 `subject / predicate / object`
- 可以写入图数据库
- 可以在前端看到节点和边

尚未完成：

- 从对话内容自动抽取三元组并入图的链路还没有完全打通

## 4.3 模型配置页已做成单独入口

用户要求提供一个可以自己填写模型接入配置的位置，这部分已经开始落地。

当前设计目标：

- 支持 OpenAI-compatible 接口
- 支持自定义 `baseUrl`
- 支持自定义 `apiMode`
- 支持为不同用途单独指定模型
  - chat
  - memory
  - search
  - embedding
  - rerank

关键文件：

- [apps/webapp/app/routes/api.v1.workspace.models.tsx](/D:/files/MemoryNote/core/apps/webapp/app/routes/api.v1.workspace.models.tsx)
- [apps/webapp/app/services/byok.server.ts](/D:/files/MemoryNote/core/apps/webapp/app/services/byok.server.ts)
- [apps/webapp/app/services/llm-provider.server.ts](/D:/files/MemoryNote/core/apps/webapp/app/services/llm-provider.server.ts)
- [apps/webapp/app/lib/model.server.ts](/D:/files/MemoryNote/core/apps/webapp/app/lib/model.server.ts)
- [apps/web-vue/src/views/SettingsModelsView.vue](/D:/files/MemoryNote/core/apps/web-vue/src/views/SettingsModelsView.vue)

当前推荐的配置方式：

- provider: `openai`
- apiMode: `chat_completions`
- baseUrl: `https://api.pie-xian.com`
- chat model: `openai/deepseek-v4-flash`
- memory model: `openai/deepseek-v4-flash`
- search model: `openai/deepseek-v4-flash`
- embedding model: `openai/qwen3-embedding-4b`
- rerank model: `openai/qwen3-reranker-4b`

原因：

- 当前代码里最稳的是 OpenAI-compatible 路线
- 不建议直接走 provider 推断成 `deepseek` 的旧路径
- 代理端点更可能支持 `chat_completions`，不一定支持 `responses`

## 4.4 Redis 已不再阻塞主流程

用户明确表达了“Redis 很碍事，可以砍掉”的方向。当前处理结论：

- Redis/BullMQ 已不再是必要启动条件
- 系统主线不应再依赖 Redis 是否连接成功
- 当前真正的主阻塞不是 Redis，而是模型接口联通性和配置生效链路

## 4.5 运行时关键结论

前面已经确认过一个重要点：

- 当前 AI SDK 请求并不是错误地打到本地 `/responses` 或 `/embeddings`
- 真实请求已经能生成完整 URL
- 真正的问题更像是：
  - 模型端点超时
  - 代理服务不支持当前调用模式
  - BYOK/工作区模型配置没有完整传递到所有调用链

---

## 5. 用户提供的模型配置

以下信息已经由用户直接提供，下一位接手者应视为当前环境测试用配置：

- Base URL: `https://api.pie-xian.com`
- 聊天 Key: `sk-6ieWcpzqvEJPFEVBJ4mNlUzDOTI8sIXJ5B5tyd2twJjGLYKp`
- 聊天模型: `deepseek-v4-flash`
- Embedding/Rerank Key: `sk-X7LTGTGHOOvgolaDuZyH7o2dpMucjd5hagdtoXqUbOnmRhZy`
- Embedding 模型: `qwen3-embedding-4b`
- Rerank 模型: `qwen3-reranker-4b`

建议在系统内部统一写成：

- `openai/deepseek-v4-flash`
- `openai/qwen3-embedding-4b`
- `openai/qwen3-reranker-4b`

注意：

- 文档移交时不要再把这些密钥散落复制到更多文件里
- 最好通过工作区模型设置接口或数据库写入一次，避免继续硬编码

---

## 6. 当前实际完成度评估

如果只看“能不能最终做成用户要的东西”，答案是：可以，但还没有完全收口。

### 已经具备雏形的部分

- Vue 主前端方向已经建立
- 中文化界面已经开始
- 对话页已经有基础交互
- 图谱页已经有可视化和手动入图
- 模型配置页已经有独立入口
- 后端已经开始围绕当前目标收缩

### 仍未真正跑通的部分

- 模型配置保存后，是否完整影响聊天调用
- embedding 配置是否完整影响向量检索与入图
- rerank 配置只是预留，未完全打通
- 聊天内容自动抽取知识并入图，没有完成闭环
- `apps/webapp` 还有类型错误，影响后续稳定修改
- Vue 页面文字有编码乱码，需要统一修复

### 判断标准

当前项目不是“做错方向”，而是“主线已经明确，但还差最后一段收口”。

---

## 7. 当前最关键的未完成问题

## 7.1 Webapp TypeScript 仍未完全清零

上一轮处理中，`apps/webapp` 还存在剩余类型问题，最关键的是以下两个链路：

### 问题 1：`knowledgeGraph.server.ts` 中 `workspaceId` 传递不完整

当前结论：

- `getRelatedMemories(...)` 内部需要 embedding
- embedding 现在希望读取 workspace 级模型配置
- 但 `workspaceId` 没有完整传进去

需要做的事：

1. 给 `getRelatedMemories` 增加 `workspaceId?: string`
2. 在调用处把 `workspaceId` 继续往下传
3. 确保 `this.getEmbedding(..., workspaceId)` 有合法来源

关键文件：

- [apps/webapp/app/services/knowledgeGraph.server.ts](/D:/files/MemoryNote/core/apps/webapp/app/services/knowledgeGraph.server.ts)

### 问题 2：`search-v2/handlers.ts` 中 rerank/vector 路径的 `workspaceId` 没传完整

当前结论：

- `applyVectorReranking(...)` 里需要 embedding
- 但函数体里直接用了不存在作用域的 `ctx.workspaceId`

需要做的事：

1. 给 `applyVectorReranking` 增加 `workspaceId?: string`
2. 从调用者把 `ctx.workspaceId` 传进去
3. 替换掉函数内部错误引用

关键文件：

- [apps/webapp/app/services/search-v2/handlers.ts](/D:/files/MemoryNote/core/apps/webapp/app/services/search-v2/handlers.ts)

## 7.2 BYOK 配置链路需要完整验证

虽然相关文件已经被改造，但还没有完成最终验收。

需要验证：

1. 设置页保存的 `baseUrl` 是否真实落到 `LLMProvider.config`
2. `chat_completions` / `responses` 选择是否真实影响请求方式
3. `openai/deepseek-v4-flash` 是否真实进入聊天调用
4. `openai/qwen3-embedding-4b` 是否真实进入 embedding 调用
5. 搜索和图谱链路是否使用了当前工作区配置，而不是默认环境变量

## 7.3 Vue 文件存在中文乱码

这个问题现在非常明显，主要体现在：

- `ConversationView.vue`
- `MemoryGraphView.vue`
- `SettingsModelsView.vue`
- 可能还有其他 Vue 文件

问题性质：

- 结构基本是可用的
- 乱码主要是编码保存不一致，不是业务逻辑本身错误

下一位接手者应优先统一为 UTF-8，再继续改 UI 文案。

---

## 8. 关键文件清单

### 8.1 Vue 前端

- [apps/web-vue/src/views/ConversationView.vue](/D:/files/MemoryNote/core/apps/web-vue/src/views/ConversationView.vue)
- [apps/web-vue/src/views/MemoryGraphView.vue](/D:/files/MemoryNote/core/apps/web-vue/src/views/MemoryGraphView.vue)
- [apps/web-vue/src/views/SettingsModelsView.vue](/D:/files/MemoryNote/core/apps/web-vue/src/views/SettingsModelsView.vue)
- [apps/web-vue/src/lib/api.ts](/D:/files/MemoryNote/core/apps/web-vue/src/lib/api.ts)

### 8.2 后端 API

- [apps/webapp/app/routes/api.v1.conversation.reply.tsx](/D:/files/MemoryNote/core/apps/webapp/app/routes/api.v1.conversation.reply.tsx)
- [apps/webapp/app/routes/api.v1.workspace.models.tsx](/D:/files/MemoryNote/core/apps/webapp/app/routes/api.v1.workspace.models.tsx)
- [apps/webapp/app/routes/api.v1.graph.clustered.tsx](/D:/files/MemoryNote/core/apps/webapp/app/routes/api.v1.graph.clustered.tsx)
- [apps/webapp/app/routes/api.v1.graph.triplets.tsx](/D:/files/MemoryNote/core/apps/webapp/app/routes/api.v1.graph.triplets.tsx)

### 8.3 模型与提供商配置

- [apps/webapp/app/services/byok.server.ts](/D:/files/MemoryNote/core/apps/webapp/app/services/byok.server.ts)
- [apps/webapp/app/services/llm-provider.server.ts](/D:/files/MemoryNote/core/apps/webapp/app/services/llm-provider.server.ts)
- [apps/webapp/app/lib/model.server.ts](/D:/files/MemoryNote/core/apps/webapp/app/lib/model.server.ts)

### 8.4 检索与图谱服务

- [apps/webapp/app/services/knowledgeGraph.server.ts](/D:/files/MemoryNote/core/apps/webapp/app/services/knowledgeGraph.server.ts)
- [apps/webapp/app/services/search-v2/handlers.ts](/D:/files/MemoryNote/core/apps/webapp/app/services/search-v2/handlers.ts)

---

## 9. 当前建议的接手顺序

下一位 AI 不要继续大范围重构，应该先收口。

建议顺序如下：

1. 修复 `apps/webapp` 当前剩余 TypeScript 错误
2. 修复 Vue 文件编码乱码，统一成 UTF-8 中文
3. 跑通 `/settings/workspace/models` 的保存与读取
4. 用用户提供的 OpenAI-compatible 配置验证聊天接口
5. 验证 embedding 配置是否进入检索/图谱链路
6. 打通“聊天 -> 抽取知识点 -> 入图”的最小自动链路
7. 最后再决定是否进一步删除旧 React/Remix UI 与剩余非核心代码

核心原则：

- 先打通闭环，不要继续铺大功能面
- 先保证模型配置和图谱入库可用
- 先让“个人知识体系搭建”能工作

---

## 10. 推荐的近期验收标准

如果要判断项目是否进入“可继续产品化”的阶段，可以用下面这组标准：

### 最低验收

1. 用户可在设置页填入模型配置并保存成功
2. 用户可在对话页正常发消息并收到回复
3. 用户可手动把一条知识三元组写入图数据库
4. 用户可在图谱页看到新增节点和关系

### 进阶验收

1. 聊天后可一键抽取知识点入图
2. 输入关键词时可通过 embedding 找回相关记忆
3. 图谱页可按实体类型、关系类型、关键词过滤

---

## 11. 当前已知事实总结

- 这个项目的方向已经从“完整复刻 CORE”转向“个人知识平台”
- Vue 前端已经是主线
- Redis 已经不该再成为阻塞点
- 当前真正卡点是模型配置链路和剩余类型问题
- 图谱已经不是纯展示旧 session 聚类，而是开始转向真正的知识三元组
- 手动入图已经有基础能力
- 自动入图还没完成闭环

---

## 12. 接手者注意事项

- 仓库当前是 dirty worktree，包含大量删改，不要做大范围回滚
- 旧 React/Remix 代码有很多被裁剪过，接手时不要默认它们都还能正常工作
- 当前优先级不是“恢复全部旧功能”，而是“把最小知识平台闭环跑通”
- 如果继续测试模型端点，优先用 OpenAI-compatible + `chat_completions`
- 如果继续推进图谱，优先围绕“专业知识实体 + 关系”建模，不要回到旧 episode cluster 语义

---

## 13. 一句话总结

当前项目已经完成了方向收缩、Vue 前端起盘、模型配置页起步、图谱可视化改造和手动入图能力，但还没有把“模型配置真正生效 + 自动知识入图 + 类型错误清零”这三件事彻底收口。下一位接手者应该以“收口闭环”为主，而不是继续扩张范围。
