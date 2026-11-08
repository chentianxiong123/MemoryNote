/**
 * 混合检索核心（抄 Cognee modules/retrieval/hybrid_retriever.py）
 *
 * Cognee HybridRetriever：把向量检索 + 图谱检索 + 文本检索混合。
 * 这里移植核心：chunks_retriever（向量块检索）+ graph 检索 + 综合。
 */

import type { Store } from "../store/pg.js";
import type { LLMProvider } from "../llm/provider.js";
import type { Entity, EntityType } from "../types/graph.js";

export interface HybridQuery {
  text: string;
  topK?: number;
  /** 是否含图谱检索 */
  useGraph?: boolean;
  /** 是否含向量块检索 */
  useVector?: boolean;
}

export interface HybridResult {
  entities: Entity[];
  chunks: Array<{ id: string; text: string; similarity: number; sourceRef: string }>;
}

export class HybridRetriever {
  constructor(
    private store: Store,
    private llm: LLMProvider
  ) {}

  /** 混合检索（抄 cognee hybrid_retriever.search） */
  async search(q: HybridQuery): Promise<HybridResult> {
    const topK = q.topK ?? 10;
    const embedding = await this.llm.embed(q.text);
    const result: HybridResult = { entities: [], chunks: [] };

    // ① 图谱检索（实体，向量相似）
    if (q.useGraph !== false) {
      const entities = await this.store.query(
        `SELECT id, name, type, description, metadata, created_at, updated_at,
                1 - (embedding <=> $1) AS similarity
         FROM entities WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1 LIMIT $2`,
        [`[${embedding.join(",")}]`, topK]
      );
      result.entities = entities.rows.map((r) => ({
        id: r.id as string, name: r.name as string, type: r.type as EntityType,
        description: (r.description as string) ?? "", embedding: [],
        metadata: (r.metadata as Record<string, unknown>) ?? {},
        createdAt: new Date(r.created_at as string), updatedAt: new Date(r.updated_at as string),
      }));
    }

    // ② 向量块检索（chunks，若 memory_entries 当块用）
    if (q.useVector !== false) {
      const chunks = await this.store.query(
        `SELECT id, content, source_ref, 1 - (embedding <=> $1) AS similarity
         FROM memory_entries WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1 LIMIT $2`,
        [`[${embedding.join(",")}]`, topK]
      );
      result.chunks = chunks.rows.map((r) => ({
        id: r.id as string, text: r.content as string,
        similarity: (r.similarity as number) ?? 0, sourceRef: (r.source_ref as string) ?? "",
      }));
    }

    return result;
  }

  /** 中文全文检索（zhparser，抄 cognee 文本检索） */
  async fullTextSearch(text: string, topK = 10): Promise<HybridResult["chunks"]> {
    const res = await this.store.query(
      `SELECT id, content, source_ref,
              ts_rank(to_tsvector('chinese', content), to_tsquery('chinese', $1)) AS rank
       FROM memory_entries
       WHERE to_tsvector('chinese', content) @@ to_tsquery('chinese', $1)
       ORDER BY rank DESC LIMIT $2`,
      [text, topK]
    );
    return res.rows.map((r) => ({
      id: r.id as string, text: r.content as string,
      similarity: (r.rank as number) ?? 0, sourceRef: (r.source_ref as string) ?? "",
    }));
  }
}
