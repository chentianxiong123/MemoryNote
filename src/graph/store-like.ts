/**
 * 图谱存储统一接口（cognify/mcp 用）
 *
 * 上游架构：图在 Kuzu（嵌入式），向量在 PG（pgvector）。
 * GraphStoreLike 定义 cognify/mcp 需要的图谱操作。
 *  - KuzuGraphStore：图操作（Kuzu）
 *  - 向量检索（searchEntities）：PG pgvector（embedding 在 PG）
 */

import type { Entity, Relation, EntityType, RelationType } from "../types/graph.js";

/** 图谱存储接口（cognify + mcp 共用的操作） */
export interface GraphStoreLike {
  /** 写入/更新实体 */
  upsertEntity(input: {
    id?: string;
    name: string;
    type: EntityType;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Entity>;
  /** 建关系 */
  addRelation(input: {
    sourceId: string;
    targetId: string;
    type: RelationType;
    weight?: number;
    evidence?: string[];
  }): Promise<Relation>;
  /** 向量语义检索实体（PG pgvector） */
  searchEntities(query: string, embedding: number[], topK?: number): Promise<Entity[]>;
  /** 图谱邻居（多跳） */
  neighbors(entityId: string, hops?: number): Promise<Array<{ entity: Entity; via: Relation }>>;
  /** 全图实体（可视化） */
  allEntities?(): Promise<Entity[]>;
  /** 全图关系（可视化） */
  allRelations?(): Promise<Relation[]>;
}
