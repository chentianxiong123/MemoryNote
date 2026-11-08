/**
 * LLM 适配层（抄 Cognee litellm 多模型统一思路 → TS）
 *
 * Cognee 用 litellm 统一多模型；TS 这里用统一接口 + 可配置 provider。
 * - openai / anthropic / ollama（本地免费）都通过 LLMProvider 接口接入。
 */

/** LLM 消息 */
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** LLM 提供者接口（cognee litellm 等价） */
export interface LLMProvider {
  /** 生成文本（抄 cognee summarize_text / extract_entities 调用） */
  complete(messages: LLMMessage[], opts?: { temperature?: number }): Promise<string>;
  /** 生成向量嵌入（抄 cognee fastembed） */
  embed(text: string): Promise<number[]>;
}

/** OpenAI 兼容 provider（openai / ollama / 任意兼容 API） */
export class OpenAICompatibleProvider implements LLMProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private embedModel: string;

  constructor(opts: { baseUrl: string; apiKey: string; model: string; embedModel?: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.embedModel = opts.embedModel ?? opts.model;
  }

  async complete(messages: LLMMessage[], opts?: { temperature?: number }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages, temperature: opts?.temperature ?? 0.2 }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content ?? "";
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.embedModel, input: text }),
    });
    if (!res.ok) throw new Error(`Embed ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0]?.embedding ?? [];
  }
}

/** 从环境变量创建 provider（cognee settings 等价） */
export function createProvider(): LLMProvider {
  const baseUrl = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1"; // 默认 ollama
  const apiKey = process.env.LLM_API_KEY ?? "ollama";
  const model = process.env.LLM_MODEL ?? "llama3.1";
  return new OpenAICompatibleProvider({ baseUrl, apiKey, model });
}
