/**
 * chunker / schema / run-state 核心单测
 */

import { describe, it, expect } from "vitest";
import { TextChunker, incrementalChunk, chunkId } from "../src/cognee/indexing/chunker.js";
import { graphSchemaToJsonSchema, mergeSchema, validateSchema, DEFAULT_GRAPH_SCHEMA } from "../src/graph/schema.js";

describe("TextChunker（抄 Chunker.py）", () => {
  it("paragraph 策略按句/段切块，带稳定 id", () => {
    const c = new TextChunker("paragraph");
    const chunks = c.chunk("第一段内容。第二段内容！第三段");
    expect(chunks.length).toBe(3);
    expect(chunks[0].id).toBe(chunkId(chunks[0].text, 0, c.chunkerId));
    expect(chunks[0].text).toBe("第一段内容。");
  });

  it("增量切块保留未变的块（incremental_chunking）", () => {
    const c = new TextChunker("paragraph");
    const oldChunks = c.chunk("相同内容。不变部分。");
    const { kept, added } = incrementalChunk(oldChunks, "相同内容。新增部分。", c);
    // 第一句相同 → kept 至少 1
    expect(kept.length).toBeGreaterThanOrEqual(1);
    expect(added.length).toBeGreaterThanOrEqual(1);
  });

  it("fixed-size 按长度切", () => {
    const c = new TextChunker("fixed-size", 1000, 200);
    expect(c.chunk("a".repeat(2500)).length).toBeGreaterThan(2);
  });
});

describe("graph schema（抄 graph_models）", () => {
  it("schema → JSON schema", () => {
    const js = graphSchemaToJsonSchema(DEFAULT_GRAPH_SCHEMA);
    expect(js.properties).toBeDefined();
    expect((js.properties as Record<string, unknown>).Person).toBeDefined();
  });

  it("merge schema 保留两边实体 + 合并字段", () => {
    const merged = mergeSchema(DEFAULT_GRAPH_SCHEMA, {
      entities: [{ name: "Person", fields: [{ name: "email", type: "string" }] }, { name: "NewType", fields: [{ name: "x", type: "number" }] }],
      relations: [],
    });
    expect(merged.entities.find((e) => e.name === "Person")?.fields.map((f) => f.name)).toContain("email");
    expect(merged.entities.find((e) => e.name === "NewType")).toBeDefined();
  });

  it("validateSchema 报非法类型", () => {
    const errs = validateSchema({ entities: [{ name: "Bad", fields: [{ name: "f", type: "bogus" as never }] }], relations: [] });
    expect(errs.length).toBe(1);
  });
});
