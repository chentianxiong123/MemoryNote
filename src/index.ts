/**
 * MemoryNote 知识库 MCP 服务入口
 *
 * 启动流程（抄 Cognee 装配）：
 *   Store(PG) → migrate → GraphStore + CognifyPipeline + MemifyPipeline + HybridRetriever
 *   + RunState(断点续跑) + TextChunker → MCP server
 *
 * 环境变量：
 *   DATABASE_URL   PG 连接串（默认 postgres://docker:docker@localhost:5433/memorynote）
 *   LLM_API_BASE   LLM API 地址（未来走 API 嵌入，默认 openai）
 *   LLM_API_KEY    API key
 *   LLM_EMBED_MODEL  embedding 模型
 *   LLM_EMBED_DIM    向量维度（默认 1536）
 */

import { Store } from "./store/pg.js";
import { GraphStore } from "./graph/graph.js";
import { HybridRetriever } from "./graph/retriever.js";
import { CognifyPipeline } from "./cognee/cognify/pipeline.js";
import { MemifyPipeline } from "./cognee/memify/memify.js";
import { RunState } from "./cognee/pipeline/run-state.js";
import { TextChunker } from "./cognee/indexing/chunker.js";
import { createEmbedder } from "./llm/embedder.js";
import { runMcpServer } from "./mcp/server.js";

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://docker:docker@localhost:5433/memorynote";

  console.error(`[memorynote] connecting: ${connectionString}`);
  const store = new Store(connectionString);
  await store.migrate();
  console.error("[memorynote] schema migrated");

  const embedder = createEmbedder();
  const graph = new GraphStore(store);
  const cognify = new CognifyPipeline(store, graph, embedder, new TextChunker("paragraph"));
  const memify = new MemifyPipeline(store, embedder);
  const retriever = new HybridRetriever(store, embedder);
  const runState = new RunState(store);
  const chunker = new TextChunker("paragraph");

  await runMcpServer({ store, graph, cognify, memify, retriever, runState, chunker, embedder });
}

main().catch((err) => {
  console.error("[memorynote] fatal:", err);
  process.exit(1);
});
