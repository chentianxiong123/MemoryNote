/**
 * chunking 核心（抄 Cognee modules/chunking/Chunker.py + incremental_chunking.py + chunk_id.py）
 *
 * Cognee TextChunker：文档 → 稳定身份的分块（chunker_id 标识策略），
 * 增量更新（incremental_chunking：按 chunk 偏移只重切变更部分）。
 */

/** chunk 稳定身份（抄 chunker_id 策略） */
export type ChunkPolicy = "fixed-size" | "paragraph" | "sentence" | "word";

export interface Chunk {
  id: string;
  text: string;
  /** 文档内偏移（增量更新用，抄 chunk_offsets） */
  start: number;
  end: number;
  chunkerId: string;
  hash: string;
}

/** chunk id（抄 chunk_id.py：稳定哈希） */
export function chunkId(text: string, start: number, chunkerId: string): string {
  const raw = `${chunkerId}:${start}:${text.slice(0, 64)}`;
  // FNV-1a 哈希
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** 按段落切块（抄 paragraph 策略） */
export function splitParagraphs(text: string): Array<{ text: string; start: number }> {
  const parts: Array<{ text: string; start: number }> = [];
  let start = 0;
  for (const line of text.split(/(?<=[。！？\n])/)) {
    if (line.trim()) parts.push({ text: line, start });
    start += line.length;
  }
  return parts;
}

/**
 * TextChunker 核心（抄 Chunker.py）
 * 按策略分块，每块带稳定 id + 偏移（增量可追踪）
 */
export class TextChunker {
  constructor(
    private policy: ChunkPolicy = "fixed-size",
    private maxChunkSize = 1000,
    private overlap = 200
  ) {}

  get chunkerId(): string {
    return `ts:${this.policy}:${this.maxChunkSize}:${this.overlap}`;
  }

  /** 分块（抄 Chunker.chunk） */
  chunk(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    switch (this.policy) {
      case "paragraph": {
        for (const p of splitParagraphs(text)) {
          chunks.push(this.makeChunk(p.text, p.start));
        }
        break;
      }
      case "sentence": {
        let start = 0;
        for (const s of text.split(/(?<=[。！？.!?])/)) {
          if (s.trim()) chunks.push(this.makeChunk(s, start));
          start += s.length;
        }
        break;
      }
      case "word": {
        // 按词切块（抄 chunk_by_word：空格/标点分词，组块到 maxChunkSize）
        const tokens = text.split(/(\s+)/);
        let buf = "";
        let start = 0;
        let cursor = 0;
        for (const t of tokens) {
          if (buf.length + t.length > this.maxChunkSize && buf.trim()) {
            chunks.push(this.makeChunk(buf, start));
            start = cursor;
            buf = "";
          }
          buf += t;
          cursor += t.length;
        }
        if (buf.trim()) chunks.push(this.makeChunk(buf, start));
        break;
      }
      default: { // fixed-size
        let i = 0;
        while (i < text.length) {
          chunks.push(this.makeChunk(text.slice(i, i + this.maxChunkSize), i));
          i += this.maxChunkSize - this.overlap;
        }
      }
    }
    return chunks;
  }

  private makeChunk(text: string, start: number): Chunk {
    const t = text.trim();
    return {
      id: chunkId(t, start, this.chunkerId),
      text: t,
      start,
      end: start + t.length,
      chunkerId: this.chunkerId,
      hash: this.fnv(t),
    };
  }

  private fnv(s: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
}

/**
 * 增量切块（抄 incremental_chunking：比较旧块偏移，只重切变化区）
 * 返回 { 保留的旧块, 新块 }
 */
export function incrementalChunk(
  oldChunks: Chunk[],
  newText: string,
  chunker: TextChunker
): { kept: Chunk[]; added: Chunk[] } {
  const newChunks = chunker.chunk(newText);
  const oldById = new Map(oldChunks.map((c) => [c.id, c]));
  const kept: Chunk[] = [];
  const added: Chunk[] = [];
  for (const nc of newChunks) {
    if (oldById.has(nc.id)) {
      kept.push(oldById.get(nc.id)!);
    } else {
      added.push(nc);
    }
  }
  return { kept, added };
}
