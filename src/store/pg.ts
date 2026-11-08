/**
 * 存储层：PostgreSQL + pgvector（抄 Cognee 1.0 单 PG 方案）
 *
 * Cognee 思路：图 + 向量 + 关系 + 元数据 全跑一个 Postgres 实例。
 * - 图谱：entities 表（含 embedding vector） + relations 表
 * - 记忆：memory_entries 表（含 embedding vector）
 * - 迁移：CREATE EXTENSION vector
 */

import { Pool } from "pg";

/** 单 PG 连接池（Cognee 单 Postgres 方案） */
export class Store {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  /** 初始化 schema（幂等，抄 Cognee migration） */
  async migrate(): Promise<void> {
    await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS entities (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        embedding   VECTOR(1536),
        metadata    JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS relations (
        id         TEXT PRIMARY KEY,
        source_id  TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        target_id  TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        type       TEXT NOT NULL,
        weight     REAL NOT NULL DEFAULT 1.0,
        evidence   TEXT[] NOT NULL DEFAULT '{}',
        metadata   JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
      CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id          TEXT PRIMARY KEY,
        content     TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_ref  TEXT NOT NULL,
        timestamp   TIMESTAMPTZ NOT NULL,
        entity_ids  TEXT[] NOT NULL DEFAULT '{}',
        embedding   VECTOR(1536),
        weight      REAL NOT NULL DEFAULT 1.0,
        metadata    JSONB NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_memory_source ON memory_entries(source_type);
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id             TEXT PRIMARY KEY,
        pipeline       TEXT NOT NULL,
        dataset        TEXT NOT NULL,
        status         TEXT NOT NULL,
        stage          TEXT NOT NULL DEFAULT 'start',
        completed_items TEXT[] NOT NULL DEFAULT '{}',
        total_items    INTEGER NOT NULL DEFAULT 0,
        retry          INTEGER NOT NULL DEFAULT 0,
        events         JSONB NOT NULL DEFAULT '[]',
        started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pipeline_runs_dataset ON pipeline_runs(dataset);
    `);
  }

  /** 执行查询（透传 pool） */
  async query(text: string, params?: unknown[]) {
    return this.pool.query(text, params);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
