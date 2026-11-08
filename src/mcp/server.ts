/**
 * MCP server（抄 Cognee MCP 集成，给 pi-loop/任何 agent 提供知识库工具）
 *
 * 工具（cognee-mcp 等价，setRequestHandler + tools/list + tools/call）：
 *  - cognify      文档/文本 → 知识图谱（indexing + cognify）
 *  - memify       会话 → 记忆
 *  - search       语义检索记忆
 *  - search_graph 图谱检索实体
 *  - neighbors    沿图谱找邻接
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Store } from "../store/pg.js";
import type { GraphStore } from "../graph/graph.js";
import type { CognifyPipeline } from "../cognee/cognify/pipeline.js";
import type { MemifyPipeline } from "../cognee/memify/memify.js";
import type { Embedder } from "../llm/embedder.js";
import type { HybridRetriever } from "../graph/retriever.js";
import type { RunState } from "../cognee/pipeline/run-state.js";
import type { TextChunker } from "../cognee/indexing/chunker.js";

export interface McpDeps {
  store: Store;
  graph: GraphStore;
  cognify: CognifyPipeline;
  memify: MemifyPipeline;
  embedder: Embedder;
  retriever: HybridRetriever;
  runState: RunState;
  chunker: TextChunker;
}

/** 工具定义（inputSchema = JSON schema） */
interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export function createMcpServer(deps: McpDeps) {
  const server = new Server(
    { name: "memorynote", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  const tools: ToolDef[] = [
    {
      name: "cognify",
      description: "文档/文本 → 知识图谱（实体+关系抽取）",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" }, sourceRef: { type: "string" } },
        required: ["text"],
      },
      handler: async (a) =>
        deps.cognify.cognify({ text: String(a.text), sourceRef: (a.sourceRef as string) ?? "mcp:cognify" }),
    },
    {
      name: "memify",
      description: "会话 → 长期记忆",
      inputSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          title: { type: "string" },
          messages: {
            type: "array",
            items: { type: "object", properties: { role: { type: "string" }, content: { type: "string" } }, required: ["role", "content"] },
          },
        },
        required: ["sessionId", "messages"],
      },
      handler: async (a) =>
        deps.memify.memify({
          id: String(a.sessionId),
          title: a.title as string | undefined,
          messages: ((a.messages as Array<{ role: string; content: string }>) ?? []).map((m) => ({
            role: m.role as "user" | "assistant" | "system" | "tool",
            content: m.content,
            timestamp: new Date(),
          })),
          metadata: {},
        }),
    },
    {
      name: "search",
      description: "语义检索记忆",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" }, topK: { type: "number", default: 5 } },
        required: ["text"],
      },
      handler: async (a) => {
        const r = await deps.memify.search({ text: String(a.text), topK: Number(a.topK ?? 5) });
        return r.map((m) => ({ id: m.id, content: m.content, sourceRef: m.sourceRef, timestamp: m.timestamp }));
      },
    },
    {
      name: "search_graph",
      description: "图谱语义检索实体",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" }, topK: { type: "number", default: 5 } },
        required: ["text"],
      },
      handler: async (a) => {
        const embedding = await deps.embedder.embed(String(a.text));
        const r = await deps.graph.searchEntities(String(a.text), embedding, Number(a.topK ?? 5));
        return r.map((e) => ({ id: e.id, name: e.name, type: e.type, description: e.description }));
      },
    },
    {
      name: "neighbors",
      description: "沿图谱找实体邻接（multi-hop）",
      inputSchema: {
        type: "object",
        properties: { entityId: { type: "string" } },
        required: ["entityId"],
      },
      handler: async (a) => {
        const r = await deps.graph.neighbors(String(a.entityId));
        return r.map((n) => ({ entity: n.entity.name, via: n.via.type }));
      },
    },
    {
      name: "hybrid_search",
      description: "混合检索（图谱实体 + 向量记忆，抄 cognee hybrid_retriever）",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" }, topK: { type: "number", default: 10 } },
        required: ["text"],
      },
      handler: async (a) => {
        const r = await deps.retriever.search({ text: String(a.text), topK: Number(a.topK ?? 10) });
        return { entities: r.entities.map((e) => ({ name: e.name, type: e.type, description: e.description })), chunks: r.chunks };
      },
    },
    {
      name: "fulltext",
      description: "中文全文检索（zhparser，抄 cognee 文本检索）",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string" }, topK: { type: "number", default: 10 } },
        required: ["text"],
      },
      handler: async (a) => {
        const r = await deps.retriever.fullTextSearch(String(a.text), Number(a.topK ?? 10));
        return r;
      },
    },
    {
      name: "run_status",
      description: "查看 pipeline 运行状态/断点续跑位置",
      inputSchema: {
        type: "object",
        properties: { runId: { type: "string" } },
        required: ["runId"],
      },
      handler: async (a) => {
        const run = await deps.runState.get(String(a.runId));
        if (!run) return { error: "run 不存在" };
        return { id: run.id, pipeline: run.pipeline, status: run.status, stage: run.stage, completed: run.completedItems.length, total: run.totalItems, pending: deps.runState.pendingItems(run) };
      },
    },
  ];

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => ({
      tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (req) => {
      const t = tools.find((x) => x.name === req.params.name);
      if (!t) return { content: [{ type: "text", text: `未知工具: ${req.params.name}` }], isError: true };
      try {
        const result = await t.handler((req.params.arguments ?? {}) as Record<string, unknown>);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `错误: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  return server;
}

/** 入口：stdio MCP server */
export async function runMcpServer(deps: McpDeps) {
  const server = createMcpServer(deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[memorynote] MCP server connected (stdio)");
}
