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
import { KuzuGraphStore } from "./graph/kuzu-graph.js";
import { HybridRetriever } from "./graph/retriever.js";
import { CognifyPipeline } from "./cognee/cognify/pipeline.js";
import { MemifyPipeline } from "./cognee/memify/memify.js";
import { RunState } from "./cognee/pipeline/run-state.js";
import { TextChunker } from "./cognee/indexing/chunker.js";
import { createEmbedder } from "./llm/embedder.js";
import { runMcpServer } from "./mcp/server.js";
import { ingestData } from "./ingestion/ingest.js";

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://docker:docker@localhost:5433/memorynote";

  console.error(`[memorynote] connecting: ${connectionString}`);
  const store = new Store(connectionString);
  await store.migrate();
  console.error("[memorynote] schema migrated");

  const embedder = createEmbedder();
  const graph = new KuzuGraphStore({ connectionString });
  await graph.migrate();
  const cognify = new CognifyPipeline(store, graph, embedder, new TextChunker("paragraph"));
  const memify = new MemifyPipeline(store, embedder);
  const retriever = new HybridRetriever(store, embedder);
  const runState = new RunState(store);
  const chunker = new TextChunker("paragraph");

  // 导入数据源→图谱（抄 cognee ingest_data：classify→chunk→cognify）
  const ingest = async (data: string | Buffer, dataset: string, filename?: string) =>
    ingestData(data, filename, {
      dataset,
      chunk: (t) => chunker.chunk(t),
      onChunks: async (chunks, sourceRef) => {
        // 每块走 cognify（写图谱）——模板空壳：LLM 抽取 TODO，先存块
        for (const c of chunks) {
          await cognify.cognify({ text: c.text, sourceRef: `${sourceRef}:${c.id}` });
        }
      },
    });

  await runMcpServer({ store, graph, cognify, memify, retriever, runState, chunker, embedder, ingest });
}

main().catch((err) => {
  console.error("[memorynote] fatal:", err);
  process.exit(1);
});
