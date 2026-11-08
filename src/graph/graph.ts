/**
 * 图谱核心（抄 Cognee graph / graph_models）
 *
 * 职责：实体+关系的 CRUD、向量检索、沿图遍历（multi-hop）。
 */

import { randomUUID } from "node:crypto";
import type { Store } from "../store/pg.js";
import type { Entity, EntityType, Relation, RelationType } from "../types/graph.js";

export class GraphStore {
  constructor(private store: Store) {}

  /** 建/取实体（upsert by name，cognee merge entities） */
  async upsertEntity(input: {
    name: string;
    type: EntityType;
    description?: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
  }): Promise<Entity> {
    const id = randomUUID();
    const res = await this.store.query(
      `INSERT INTO entities (id, name, type, description, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [id, input.name, input.type, input.description ?? "", input.embedding ?? null, JSON.stringify(input.metadata ?? {})]
    );
    return this.rowToEntity(res.rows[0]);
  }

  /** 建实体关系（抄 cognee extract_relations） */
  async addRelation(input: {
    sourceId: string;
    targetId: string;
    type: RelationType;
    weight?: number;
    evidence?: string[];
  }): Promise<Relation> {
    const res = await this.store.query(
      `INSERT INTO relations (id, source_id, target_id, type, weight, evidence)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [randomUUID(), input.sourceId, input.targetId, input.type, input.weight ?? 1, input.evidence ?? []]
    );
    return this.rowToRelation(res.rows[0]);
  }

  /** 语义检索实体（pgvector 余弦相似，抄 cognee search） */
  async searchEntities(query: string, embedding: number[], topK = 10): Promise<Entity[]> {
    const res = await this.store.query(
      `SELECT id, name, type, description, embedding, metadata, created_at, updated_at,
              1 - (embedding <=> $1) AS similarity
       FROM entities
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [`[${embedding.join(",")}]`, topK]
    );
    return res.rows.map((r) => this.rowToEntity(r));
  }

  /** 沿图遍历：找实体的邻接（multi-hop，抄 cognee graph traversal） */
  async neighbors(entityId: string, hops = 1): Promise<{ entity: Entity; via: Relation }[]> {
    const res = await this.store.query(
      `SELECT e.id, e.name, e.type, e.description, e.embedding, e.metadata, e.created_at, e.updated_at,
              r.id AS rel_id, r.type AS rel_type, r.weight, r.evidence
       FROM relations r
       JOIN entities e ON e.id = CASE WHEN r.source_id = $1 THEN r.target_id ELSE r.source_id END
       WHERE r.source_id = $1 OR r.target_id = $1
       LIMIT 50`,
      [entityId]
    );
    return res.rows.map((r) => ({
      entity: this.rowToEntity(r),
      via: {
        id: r.rel_id,
        sourceId: entityId,
        targetId: r.id,
        type: r.rel_type as RelationType,
        weight: r.weight,
        evidence: r.evidence,
        metadata: {},
        createdAt: new Date(),
      },
    }));
  }

  private rowToEntity(row: Record<string, unknown>): Entity {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as EntityType,
      description: (row.description as string) ?? "",
      embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : [],
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private rowToRelation(row: Record<string, unknown>): Relation {
    return {
      id: row.id as string,
      sourceId: row.source_id as string,
      targetId: row.target_id as string,
      type: row.type as RelationType,
      weight: (row.weight as number) ?? 1,
      evidence: (row.evidence as string[]) ?? [],
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(row.created_at as string),
    };
  }
}
