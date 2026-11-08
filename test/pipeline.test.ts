/**
 * 核心管线单测（chunkText / 抽取解析）
 */

import { describe, it, expect } from "vitest";
import { chunkText } from "../src/cognee/cognify/pipeline.js";

describe("chunkText（抄 Cognee TextChunker）", () => {
  it("切块长度正确", () => {
    const text = "a".repeat(2500);
    const chunks = chunkText(text, 1000, 200);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].length).toBe(1000);
  });

  it("短文本单块", () => {
    expect(chunkText("short").length).toBe(1);
  });

  it("重叠（overlap）生效", () => {
    const text = "x".repeat(1200);
    const chunks = chunkText(text, 1000, 200);
    // 1200 字, chunk 1000, overlap 200: 第2块从 800 开始 → 共 2 块
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(1000);
    expect(chunks[1].length).toBe(400); // 1200-800
  });
});
