/**
 * cognify 核心管线（抄 Cognee memory_pipelines 两段式）
 *
 * 策略（用户拍板）：未来走 LLM API，本文件是【模板空壳】——
 * 接口定好（cognify/extractEntities），LLM 抽取是 TODO 占位（不实际测试）。
 * 拒绝本地模型/本地功能。
 */

import { randomUUID } from "node:crypto";
import type { Embedder } from "../../llm/embedder.js";
import type { GraphStore } from "../../graph/graph.js";
import type { Store } from "../../store/pg.js";
import type { EntityType, RelationType } from "../../types/graph.js";

/** 实体抽取结果（未来 LLM 返回 JSON） */
export interface ExtractionResult {
  entities: Array<{ name: string; type: EntityType; description: string }>;
  relations: Array<{ source: string; target: string; type: RelationType }>;
}

/** 实体+关系抽取 prompt（抄 cognee extract_entities 思路） */
const EXTRACT_PROMPT = `你是一个知识图谱提取器。从给定文本中提取实体和关系。
返回严格 JSON 格式（不要 markdown，不要注释）：
{
  "entities": [{"name": "实体名", "type": "Person|Organization|Place|Concept|Event|Product|Technology|Task|Document|Topic|Other", "description": "一句话描述"}],
  "relations": [{"source": "实体名A", "target": "实体名B", "type": "RELATED_TO|PART_OF|MEMBER_OF|LEADS|LOCATED_IN|PRODUCES|USES|MENTIONS|CITES|CAUSES|DEPENDS_ON|CREATED_BY|OTHER"}]
}
只提取明确、相关的实体和关系，宁少勿滥。文本：`;

export class CognifyPipeline {
  constructor(
    private store: Store,
    private graph: GraphStore,
    private embedder: Embedder,
    private chunker: { chunk(text: string): Array<{ id: string; text: string; start: number; end: number; chunkerId: string; hash: string }> }
  ) {}

  /**
   * 完整认知化（抄 cognee cognify()：indexing + cognify 两段）
   * 模板空壳——不实际测试。未来：chunk → embed(API) → LLM 抽取 → 写图谱。
   */
  async cognify(source: { text: string; sourceRef: string; sourceType?: string }): Promise<{
    entities: number;
    relations: number;
    chunks: number;
  }> {
    // ① indexing：切块（TextChunker）
    const chunks = this.chunker.chunk(source.text);
    // ② 嵌入（未来：LLM API /embeddings）
    const embeddings = await Promise.all(chunks.map((c) => this.embedder.embed(c.text)));
    void embeddings;
    // ③ 实体+关系抽取（未来：LLM extract_entities）
    const extraction = await this.extractEntities(source.text);

    // ④ 写图谱（upsert 实体 + 建关系）
    const idByName = new Map<string, string>();
    for (const e of extraction.entities) {
      const ent = await this.graph.upsertEntity({
        name: e.name,
        type: e.type,
        description: e.description,
        metadata: { sourceRef: source.sourceRef },
      });
      idByName.set(e.name, ent.id);
    }
    let relationCount = 0;
    for (const r of extraction.relations) {
      const s = idByName.get(r.source);
      const t = idByName.get(r.target);
      if (s && t) {
        await this.graph.addRelation({ sourceId: s, targetId: t, type: r.type, evidence: [source.sourceRef] });
        relationCount++;
      }
    }

    return { entities: extraction.entities.length, relations: relationCount, chunks: chunks.length };
  }

  /**
   * 实体+关系抽取（抄 cognee extract_entities）
   * TODO(未来)：调 LLM API chat/completions，传 EXTRACT_PROMPT，解析 JSON。
   * 模板空壳——返回空结果，不实际测试。
   */
  private async extractEntities(text: string): Promise<ExtractionResult> {
    void text; // TODO(未来)：LLM API 抽取
    return { entities: [], relations: [] };
  }
}
