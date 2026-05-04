export type LLMProvider = "openai" | "anthropic" | "google" | "openrouter" | "custom";
export type LLMModelConfig = {
  id: string;
  name: string;
  provider: LLMProvider;
  contextWindow?: number;
};

export type BYOKConfig = {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string;
  models?: LLMModelConfig[];
};

export function getBYOKConfig(userId: string): BYOKConfig | null {
  return null;
}

export function saveBYOKConfig(userId: string, config: BYOKConfig): void {}

export function deleteBYOKConfig(userId: string): void {}

export function hasBYOKConfig(userId: string): boolean {
  return false;
}
