/**
 * 知识图谱数据模型（抄 Cognee graph_models / engine EntityType 核心）
 *
 * Cognee 思路：文档/代码/会话 → 实体抽取 → 关系建立 → 图谱（节点=实体，边=关系）
 * 存单个 Postgres（pgvector 向量 + 关系 + 元数据一体）。
 */

/** 实体类型（抄 Cognee EntityType 常见类型） */
export type EntityType =
  | "Person"
  | "Organization"
  | "Place"
  | "Concept"
  | "Event"
  | "Product"
  | "Technology"
  | "Task"
  | "Document"
  | "Topic"
  | "Other";

/** 关系类型 */
export type RelationType =
  | "RELATED_TO"
  | "PART_OF"
  | "MEMBER_OF"
  | "LEADS"
  | "LOCATED_IN"
  | "PRODUCES"
  | "USES"
  | "MENTIONS"
  | "CITES"
  | "CAUSES"
  | "DEPENDS_ON"
  | "CREATED_BY"
  | "OTHER";

/** 图谱节点（= 实体，含向量嵌入） */
export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  /** 实体描述（LLM 总结生成，cognee consolidate_entity_descriptions） */
  description: string;
  /** 向量嵌入（pgvector），用于语义检索 */
  embedding: number[];
  /** 元数据 */
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** 图谱边（= 实体关系） */
export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  /** 关系权重（apply_feedback_weights 反馈加权） */
  weight: number;
  /** 关系证据（来自哪个 chunk/来源） */
  evidence: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/** 知识图谱 */
export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

/** 图谱查询结果 */
export interface GraphQueryResult {
  entities: Entity[];
  relations: Relation[];
  /** 检索的实体/概念 */
  matched: string[];
}
