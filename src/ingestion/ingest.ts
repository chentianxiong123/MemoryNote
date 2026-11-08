/**
 * ingestion 导入层（抄 Cognee modules/ingestion + tasks/ingestion/ingest_data.py）
 *
 * 上游流程：ingest_data(data, dataset) → classify（TextData/BinaryData）→
 *   存 → chunk → 待 cognify。这里抄核心：
 *   - IngestionData 抽象（get_data/get_identifier/get_metadata）
 *   - TextData / BinaryData（具体数据类型）
 *   - classify（类型识别）
 *   - ingestData（导入入口：数据源 → 识别 → 切块 → 存图谱）
 */

import { randomUUID } from "node:crypto";

/** 数据抽象（抄 IngestionData.py Protocol） */
export interface IngestionData {
  data: string | Buffer;
  /** 读取数据（TextData 直接返回文本；BinaryData 读 buffer） */
  getData(): Promise<string | Buffer>;
  /** 稳定标识（content_hash） */
  getIdentifier(): Promise<string>;
  /** 元数据 */
  getMetadata(): Promise<Record<string, unknown>>;
}

/** 文本数据（抄 TextData.py） */
export class TextData implements IngestionData {
  constructor(public data: string) {}

  async getData(): Promise<string | Buffer> {
    return this.data;
  }

  async getIdentifier(): Promise<string> {
    return this.hash(this.data);
  }

  async getMetadata(): Promise<Record<string, unknown>> {
    return { content_hash: this.hash(this.data), mime_type: "text/plain" };
  }

  private hash(s: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
}

/** 二进制数据（抄 BinaryData.py） */
export class BinaryData implements IngestionData {
  constructor(
    public data: Buffer,
    public name: string
  ) {}

  async getData(): Promise<string | Buffer> {
    return this.data;
  }

  async getIdentifier(): Promise<string> {
    return this.hash(Buffer.from(this.data).toString("base64"));
  }

  async getMetadata(): Promise<Record<string, unknown>> {
    return { content_hash: this.hash(Buffer.from(this.data).toString("base64")), filename: this.name };
  }

  private hash(s: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
}

/** 类型识别（抄 classify.py：字符串→TextData，Buffer→BinaryData） */
export function classify(data: string | Buffer, filename?: string): IngestionData {
  if (typeof data === "string") return new TextData(data);
  if (Buffer.isBuffer(data)) {
    const name = filename ?? "data.bin";
    return new BinaryData(data, name);
  }
  throw new Error(`不支持的 ingestion 数据类型: ${typeof data}`);
}

export interface IngestOptions {
  dataset: string;
  /** 切块器（TextChunker） */
  chunk: (text: string) => Array<{ id: string; text: string; start: number; end: number; chunkerId: string; hash: string }>;
  /** 写入图谱（cognify pipeline 或直接回调） */
  onChunks: (chunks: Array<{ id: string; text: string }>, sourceRef: string) => Promise<void>;
}

/**
 * 导入入口（抄 ingest_data：数据源 → classify → 切块 → 回调存图谱）
 * 返回 { id, dataset, chunks, sourceRef }
 */
export async function ingestData(
  data: string | Buffer,
  filename: string | undefined,
  opts: IngestOptions
): Promise<{ id: string; dataset: string; chunks: number; sourceRef: string }> {
  const item = classify(data, filename);
  const content = await item.getData();
  const identifier = await item.getIdentifier();
  const sourceRef = `${opts.dataset}:${identifier}`;

  // 切块（TextChunker）
  const chunks = opts.chunk(typeof content === "string" ? content : content.toString("utf8"));

  // 回调写图谱（cognify 或直接存）
  await opts.onChunks(
    chunks.map((c) => ({ id: c.id, text: c.text })),
    sourceRef
  );

  return { id: randomUUID(), dataset: opts.dataset, chunks: chunks.length, sourceRef };
}
