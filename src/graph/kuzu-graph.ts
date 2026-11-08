/**
 * Kuzu 嵌入式图数据库图谱存储（抄 Cognee graph 后端：Ladybug=Kuzu 继任）
 *
 * 上游架构（用户拍板"上游用什么我们用什么"）：
 *   - 图（实体/关系）：Kuzu 嵌入式图数据库（本地文件，SQL 图查询，多跳快）
 *   - 向量：PostgreSQL pgvector（memory_entries/entities 的 embedding）
 *   - 元数据：PostgreSQL（source_ref 等）
 *
 * Kuzu 是 Ladybug 的官方 JS 绑定（0.11.3，in-process 图数据库）。
 * 注意：kuzu 0.11 的 query(statement) 无 params，参数化用 prepare+execute。
 */

import { Database, Connection, type QueryResult, type PreparedStatement } from "kuzu";
import { randomUUID } from "node:crypto";
import type { Entity, Relation, EntityType, RelationType } from "../types/graph.js";
import type { Store } from "../store/pg.js";

export interface KuzuGraphOptions {
  /** 图数据库文件路径（默认 ./memorynote-graph） */
  path?: string;
  /** PG 连接串（向量检索用，embedding 在 PG） */
  connectionString?: string;
}

export class KuzuGraphStore {
  private db: Database;
  private conn: Connection;
  private store: Store | null;

  constructor(opts: KuzuGraphOptions = {}) {
    this.db = new Database(opts.path ?? "./memorynote-graph");
    this.conn = new Connection(this.db);
    this.store = null;
    this.connectionString = opts.connectionString ?? null;
  }

  private connectionString: string | null;

  /** 延迟连接 PG（向量检索用，embedding 在 PG） */
  private async ensureStore(): Promise<Store | null> {
    if (!this.connectionString) return null;
    if (!this.store) {
      const { Store } = await import("../store/pg.js");
      this.store = new Store(this.connectionString);
    }
    return this.store;
  }

  /** 建图 schema（抄 cognee graph_models：Entity 节点 + Relation 边） */
  async migrate(): Promise<void> {
    await this.run(
      `CREATE NODE TABLE IF NOT EXISTS Entity(id STRING, name STRING, type STRING, description STRING, metadata STRING, PRIMARY KEY(id))`
    );
    await this.run(
      `CREATE REL TABLE IF NOT EXISTS Relation(FROM Entity TO Entity, type STRING, weight DOUBLE, evidence STRING)`
    );
  }

  /** 写入/更新实体（抄 cognee upsert_nodes） */
  async upsertEntity(input: {
    id?: string;
    name: string;
    type: EntityType;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Entity> {
    const id = input.id ?? randomUUID();
    const description = input.description ?? "";
    const metadata = JSON.stringify(input.metadata ?? {});
    // kuzu 0.11 的 MERGE+ON CREATE/ON MATCH 参数绑定有坑——改用先查后插（upsert）
    const existing = await this.all(
      `MATCH (e:Entity {id: $id}) RETURN e.id AS id`,
      { id }
    );
    if (existing.length) {
      await this.run(
        `MATCH (e:Entity {id: $id}) SET e.name=$name, e.type=$type, e.description=$descr, e.metadata=$meta`,
        { id, name: input.name, type: input.type, descr: description, meta: metadata }
      );
    } else {
      await this.run(
        `CREATE (e:Entity {id: $id, name: $name, type: $type, description: $descr, metadata: $meta})`,
        { id, name: input.name, type: input.type, descr: description, meta: metadata }
      );
    }
    return { id, name: input.name, type: input.type, description, embedding: [], metadata: input.metadata ?? {}, createdAt: new Date(), updatedAt: new Date() };
  }

  /** 建关系（抄 cognee upsert_edges） */
  async addRelation(input: {
    sourceId: string;
    targetId: string;
    type: RelationType;
    weight?: number;
    evidence?: string[];
  }): Promise<Relation> {
    const id = randomUUID();
    const weight = input.weight ?? 1;
    const evidence = JSON.stringify(input.evidence ?? []);
    await this.run(
      `MATCH (a:Entity), (b:Entity) WHERE a.id=$s AND b.id=$t
       CREATE (a)-[r:Relation {type: $type, weight: $w, evidence: $ev}]->(b)`,
      { s: input.sourceId, t: input.targetId, type: input.type, w: weight, ev: evidence }
    );
    return { id, sourceId: input.sourceId, targetId: input.targetId, type: input.type, weight, evidence: input.evidence ?? [], metadata: {}, createdAt: new Date() };
  }

  /** 实体检索（Kuzu 图查询，多跳邻居） */
  async neighbors(entityId: string, hops = 1): Promise<Array<{ entity: Entity; via: Relation }>> {
    // kuzu 0.11 递归关系属性访问受限（RECURSIVE_REL）——单跳取关系，多跳客户端迭代
    const rows = await this.all(
      `MATCH (a:Entity)-[r:Relation]->(b:Entity) WHERE a.id=$id
       RETURN b.id AS id, b.name AS name, b.type AS type, b.description AS description,
              b.metadata AS metadata, r.type AS rtype, r.weight AS rweight, r.evidence AS revidence`,
      { id: entityId }
    );
    let found = rows.map((r) => ({ entity: this.rowToEntity(r), via: this.rowToRelation(r) }));
    if (hops > 1) {
      // 逐跳扩展（客户端迭代，避免递归关系属性限制）
      let frontier = new Set([entityId]);
      for (let h = 1; h < hops; h++) {
        const next = new Set<string>();
        for (const f of frontier) {
          const r = await this.all(
            `MATCH (a:Entity)-[rel:Relation]->(b:Entity) WHERE a.id=$id
             RETURN b.id AS id, b.name AS name, b.type AS type, b.description AS description,
                    b.metadata AS metadata, rel.type AS rtype, rel.weight AS rweight, rel.evidence AS revidence`,
            { id: f }
          );
          for (const row of r) {
            next.add(row.id as string);
            found.push({ entity: this.rowToEntity(row), via: this.rowToRelation(row) });
          }
        }
        frontier = next;
      }
    }
    return rows.map((r) => ({
      entity: this.rowToEntity(r),
      via: this.rowToRelation(r),
    }));
  }

  /** 全图实体（图谱可视化用） */
  async allEntities(): Promise<Entity[]> {
    const rows = await this.all(`MATCH (e:Entity) RETURN e.id AS id, e.name AS name, e.type AS type, e.description AS description, e.metadata AS metadata`);
    return rows.map((r) => this.rowToEntity(r));
  }

  /** 全图关系（图谱可视化用） */
  async allRelations(): Promise<Relation[]> {
    const rows = await this.all(
      `MATCH (a:Entity)-[r:Relation]->(b:Entity) RETURN a.id AS sid, b.id AS tid, r.type AS type, r.weight AS weight, r.evidence AS evidence`
    );
    return rows.map((r) => ({
      id: randomUUID(),
      sourceId: r.sid as string,
      targetId: r.tid as string,
      type: r.type as RelationType,
      weight: (r.weight as number) ?? 1,
      evidence: this.parseJsonArray(r.evidence),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /** 度数最高的实体（图谱 hub 指标，抄 cognee 图中心度） */
  async hub(): Promise<{ entityId: string; name: string; degree: number } | null> {
    const rows = await this.all(
      `MATCH (a:Entity)-[r:Relation]-(b:Entity) RETURN a.id AS id, a.name AS name, count(r) AS degree ORDER BY degree DESC LIMIT 1`
    );
    if (!rows[0]) return null;
    return { entityId: rows[0].id as string, name: rows[0].name as string, degree: (rows[0].degree as number) ?? 0 };
  }

  /** 向量语义检索实体（PG pgvector，embedding 在 PG） */
  async searchEntities(query: string, embedding: number[], topK = 10): Promise<Entity[]> {
    const store = await this.ensureStore();
    if (!store) {
      // 无 PG 时退化为 Kuzu 全图模糊（图谱可视化场景）
      const all = await this.allEntities();
      return all.filter((e) => e.name.includes(query)).slice(0, topK);
    }
    const res = await store.query(
      `SELECT id, name, type, description, embedding, metadata, created_at, updated_at,
              1 - (embedding <=> $1) AS similarity
       FROM entities
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1
       LIMIT $2`,
      [`[${embedding.join(",")}]`, topK]
    );
    return res.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      type: r.type as EntityType,
      description: (r.description as string) ?? "",
      embedding: [],
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(r.created_at as string),
      updatedAt: new Date(r.updated_at as string),
    }));
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  /** 执行写查询（prepare + execute 带参） */
  private async run(statement: string, params?: Record<string, unknown>): Promise<void> {
    if (params) {
      const ps = await this.conn.prepare(statement);
      await this.conn.execute(ps, params as Record<string, never>);
    } else {
      await this.conn.query(statement);
    }
  }

  /** 查询所有行（prepare + execute 带参） */
  private async all(statement: string, params?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    let result: QueryResult | QueryResult[];
    if (params) {
      const ps = await this.conn.prepare(statement);
      result = await this.conn.execute(ps, params as Record<string, never>);
    } else {
      result = await this.conn.query(statement);
    }
    const qr = Array.isArray(result) ? result[0] : result;
    if (!qr) return [];
    return (await qr.getAll()) as Record<string, unknown>[];
  }

  private rowToEntity(r: Record<string, unknown>): Entity {
    return {
      id: r.id as string,
      name: r.name as string,
      type: r.type as EntityType,
      description: (r.description as string) ?? "",
      embedding: [],
      metadata: this.parseJson(r.metadata),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private rowToRelation(r: Record<string, unknown>): Relation {
    return {
      id: randomUUID(),
      sourceId: (r.sid as string) ?? "",
      targetId: (r.tid as string) ?? "",
      type: (r.rtype as RelationType) ?? (r.type as RelationType) ?? "RELATED_TO",
      weight: ((r.rweight as number) ?? (r.weight as number) ?? 1),
      evidence: this.parseJsonArray(r.revidence ?? r.evidence),
      metadata: {},
      createdAt: new Date(),
    };
  }

  private parseJson(v: unknown): Record<string, unknown> {
    if (typeof v === "string") {
      try { return JSON.parse(v); } catch { return {}; }
    }
    return {};
  }

  private parseJsonArray(v: unknown): string[] {
    if (typeof v === "string") {
      try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
  }
}

export type { QueryResult, PreparedStatement };
