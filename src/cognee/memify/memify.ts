/**
 * memify 记忆化（抄 Cognee memify / persist_sessions_in_knowledge_graph）
 *
 * 会话（对话/经验）→ 持久化为可检索记忆条目（链接到图谱实体）。
 */

import { randomUUID } from "node:crypto";
import type { Store } from "../../store/pg.js";
import type { LLMProvider } from "../../llm/provider.js";
import type { Session, MemoryEntry, MemoryQuery, MemorySourceType } from "../../types/memory.js";

export class MemifyPipeline {
  constructor(
    private store: Store,
    private llm: LLMProvider
  ) {}

  /** 会话 → 记忆（抄 cognee persist_sessions_in_knowledge_graph） */
  async memify(session: Session): Promise<{ entries: number }> {
    // 会话文本（拼接消息）
    const content = session.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    // 摘要（cognee summarize_text）
    const summary = await this.summarize(content);
    const embedding = await this.llm.embed(summary);

    await this.store.query(
      `INSERT INTO memory_entries (id, content, source_type, source_ref, timestamp, entity_ids, embedding, weight, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        summary,
        session.messages[0]?.role === "assistant" ? ("conversation" as MemorySourceType) : "other",
        session.id,
        new Date().toISOString(),
        [],
        `[${embedding.join(",")}]`,
        1,
        JSON.stringify({ ...session.metadata, title: session.title }),
      ]
    );
    return { entries: 1 };
  }

  /** 记忆检索（语义，抄 cognee search / recall） */
  async search(query: MemoryQuery): Promise<MemoryEntry[]> {
    const embedding = await this.llm.embed(query.text);
    let sql = `SELECT id, content, source_type, source_ref, timestamp, entity_ids, weight, metadata,
               1 - (embedding <=> $1) AS similarity
               FROM memory_entries WHERE embedding IS NOT NULL`;
    const params: unknown[] = [`[${embedding.join(",")}]`];
    let idx = 2;
    if (query.entityIds?.length) {
      sql += ` AND entity_ids && $${idx}`;
      params.push(query.entityIds);
      idx++;
    }
    if (query.sourceType) {
      sql += ` AND source_type = $${idx}`;
      params.push(query.sourceType);
      idx++;
    }
    if (query.since) {
      sql += ` AND timestamp >= $${idx}`;
      params.push(query.since.toISOString());
      idx++;
    }
    sql += ` ORDER BY embedding <=> $1 LIMIT $${idx}`;
    params.push(query.topK);

    const res = await this.store.query(sql, params);
    return res.rows.map((r) => ({
      id: r.id as string,
      content: r.content as string,
      sourceType: r.source_type as MemorySourceType,
      sourceRef: r.source_ref as string,
      timestamp: new Date(r.timestamp as string),
      entityIds: (r.entity_ids as string[]) ?? [],
      embedding: [],
      weight: (r.weight as number) ?? 1,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    }));
  }

  /** 摘要（抄 cognee summarize_text） */
  private async summarize(text: string): Promise<string> {
    const raw = await this.llm.complete([
      { role: "system", content: "你是一个记忆摘要器。把下面的会话/内容浓缩成一段简洁、可检索的摘要（保留关键实体、决策、结论）。" },
      { role: "user", content: text.slice(0, 8000) },
    ]);
    return raw.trim();
  }
}
