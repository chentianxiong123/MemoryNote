/**
 * Embedding 接口（未来走 LLM API 嵌入）
 *
 * 策略（用户拍板）：拒绝本地模型/本地功能，未来走 LLM API 嵌入。
 * 本文件是【模板空壳】——接口定好，`ApiEmbedder.embed()` 是 TODO 占位，
 * 未来填 LLM /embeddings API 调用。不实际测试（仅保证编译通过）。
 */

export interface Embedder {
  /** 生成向量（未来：LLM API /embeddings） */
  embed(text: string): Promise<number[]>;
  /** 向量维度（按 API 模型配置） */
  readonly dim: number;
}

export interface ApiEmbedderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  dim: number;
}

/**
 * API 嵌入器（模板空壳）
 * TODO(未来)：POST {baseUrl}/embeddings，Bearer {apiKey}，body {model, input}
 * → 解析 data[0].embedding。当前返回占位零向量，不实际测试。
 */
export class ApiEmbedder implements Embedder {
  readonly dim: number;
  constructor(public readonly config: ApiEmbedderConfig) {
    this.dim = config.dim;
  }
  async embed(text: string): Promise<number[]> {
    void text; // TODO(未来)：调 LLM API /embeddings
    return new Array(this.dim).fill(0);
  }
}

/** 从环境变量创建 API 嵌入器（模板配置） */
export function createEmbedder(env: NodeJS.ProcessEnv = process.env): Embedder {
  return new ApiEmbedder({
    baseUrl: env.LLM_API_BASE ?? "https://api.openai.com/v1",
    apiKey: env.LLM_API_KEY ?? "",
    model: env.LLM_EMBED_MODEL ?? "text-embedding-ada-002",
    dim: Number(env.LLM_EMBED_DIM ?? 1536),
  });
}

export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
