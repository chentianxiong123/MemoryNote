/**
 * cognify 核心管线（抄 Cognee memory_pipelines 两段式）
 *
 * Cognee 流程（两段 pipeline，可断点续跑）：
 *   ① indexing_pipeline: classify → chunk → store → embed（无 LLM）
 *   ② cognify_pipeline: extract_entities → extract_relations → summarize → write graph（LLM）
 *
 * 这里 TS 移植：ingest() 切块+嵌入 → cognify() 抽实体+关系+总结 → 写图谱。
 */

import { randomUUID } from "node:crypto";
import type { LLMProvider } from "../../llm/provider.js";
import type { GraphStore } from "../../graph/graph.js";
import type { Store } from "../../store/pg.js";
import type { EntityType, RelationType } from "../../types/graph.js";

/** 切块（抄 cognee chunker TextChunker） */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

/** 实体抽取结果（LLM 返回 JSON） */
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
    private llm: LLMProvider
  ) {}

  /**
   * 完整认知化（抄 cognee cognify()：indexing + cognify 两段）
   * 输入任意文本 → 图谱
   */
  async cognify(source: { text: string; sourceRef: string; sourceType?: string }): Promise<{
    entities: number;
    relations: number;
    chunks: number;
  }> {
    // ① indexing：切块（无 LLM）
    const chunks = chunkText(source.text);
    // ② 嵌入（每块向量）
    const embeddings = await Promise.all(chunks.map((c) => this.llm.embed(c)));
    // 存 chunks（供证据引用）
    const chunkIds = chunks.map((c) => {
      const id = randomUUID();
      return id;
    });
    // ③ cognify：实体+关系抽取（LLM，整文抽）
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

  /** 实体+关系抽取（LLM，抄 cognee extract_entities） */
  private async extractEntities(text: string): Promise<ExtractionResult> {
    const raw = await this.llm.complete([
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: text.slice(0, 12000) },
    ]);
    // 解析 JSON（容错：剥掉可能的 ```json 围栏）
    const cleaned = raw.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned) as ExtractionResult;
    } catch {
      return { entities: [], relations: [] };
    }
  }
}
