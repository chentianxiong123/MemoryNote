/**
 * MemoryNote 知识库 MCP 服务入口
 *
 * 启动流程（抄 Cognee 装配）：
 *   Store(PG) → migrate → GraphStore + CognifyPipeline + MemifyPipeline + HybridRetriever
 *   + RunState(断点续跑) + TextChunker → MCP server
 *
 * 环境变量：
 *   DATABASE_URL   PG 连接串（默认 postgres://docker:docker@localhost:5433/memorynote）
 *   LLM_BASE_URL   LLM API 地址（默认 ollama http://localhost:11434/v1）
 *   LLM_MODEL      模型名
 */

import { Store } from "./store/pg.js";
import { GraphStore } from "./graph/graph.js";
import { HybridRetriever } from "./graph/retriever.js";
import { CognifyPipeline } from "./cognee/cognify/pipeline.js";
import { MemifyPipeline } from "./cognee/memify/memify.js";
import { RunState } from "./cognee/pipeline/run-state.js";
import { TextChunker } from "./cognee/indexing/chunker.js";
import { createProvider } from "./llm/provider.js";
import { runMcpServer } from "./mcp/server.js";

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://docker:docker@localhost:5433/memorynote";

  console.error(`[memorynote] connecting: ${connectionString}`);
  const store = new Store(connectionString);
  await store.migrate();
  console.error("[memorynote] schema migrated");

  const llm = createProvider();
  const graph = new GraphStore(store);
  const cognify = new CognifyPipeline(store, graph, llm);
  const memify = new MemifyPipeline(store, llm);
  const retriever = new HybridRetriever(store, llm);
  const runState = new RunState(store);
  const chunker = new TextChunker("paragraph");

  await runMcpServer({ store, graph, cognify, memify, retriever, runState, chunker, llm });
}

main().catch((err) => {
  console.error("[memorynote] fatal:", err);
  process.exit(1);
});
