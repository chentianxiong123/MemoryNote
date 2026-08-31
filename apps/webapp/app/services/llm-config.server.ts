import fs from "node:fs";
import path from "node:path";
import { env } from "~/env.server";

const ROUTES_DIR = "/mnt/shared/MemoryNote/apps/webapp/app/routes";
const ENV_FILE = path.resolve(ROUTES_DIR, "..", "..", "..", ".env");

export type RuntimeKey =
  | "OPENAI_API_KEY"
  | "OPENAI_BASE_URL"
  | "OPENAI_API_MODE"
  | "MODEL"
  | "EMBEDDING_MODEL"
  | "EMBEDDING_MODEL_SIZE";

export interface LLMRuntimeConfig {
  openaiApiKey: string | null;
  openaiBaseUrl: string | null;
  openaiApiMode: string;
  chatModel: string;
  embeddingModel: string;
  embeddingModelSize: string;
}

const overrides = new Map<RuntimeKey, string | null>();

function readProcess(key: RuntimeKey): string | null {
  const v = process.env[key];
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

function readBase(key: RuntimeKey): string | null {
  const override = overrides.get(key);
  if (override !== undefined) return override;
  const fromProcess = readProcess(key);
  if (fromProcess !== null) return fromProcess;
  const v = (env as unknown as Record<string, unknown>)[key];
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

export function getLLMConfig(): LLMRuntimeConfig {
  return {
    openaiApiKey: readBase("OPENAI_API_KEY"),
    openaiBaseUrl: readBase("OPENAI_BASE_URL"),
    openaiApiMode: readBase("OPENAI_API_MODE") ?? "chat_completions",
    chatModel: readBase("MODEL") ?? "gpt-4o-mini",
    embeddingModel: readBase("EMBEDDING_MODEL") ?? "text-embedding-3-small",
    embeddingModelSize: readBase("EMBEDDING_MODEL_SIZE") ?? "1024",
  };
}

function applyToProcess(updates: Record<RuntimeKey, string | null>) {
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function writeEnvFile(updates: Record<RuntimeKey, string | null>) {
  let content = "";
  if (fs.existsSync(ENV_FILE)) {
    content = fs.readFileSync(ENV_FILE, "utf-8");
  }

  const lines = content.split(/\r?\n/);
  const seen = new Set<RuntimeKey>();
  const next: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/);
    if (match) {
      const key = match[1] as RuntimeKey;
      if (key in updates) {
        const value = updates[key];
        if (value === null) {
          seen.add(key);
          continue;
        }
        const needsQuote = /[\s#"']/.test(value);
        const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        next.push(`${key}=${needsQuote ? `"${escaped}"` : value}`);
        seen.add(key);
        continue;
      }
    }
    next.push(line);
  }

  const trailingNewline = content.endsWith("\n");
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) continue;
    if (seen.has(key as RuntimeKey)) continue;
    const needsQuote = /[\s#"']/.test(value);
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    next.push(`${key}=${needsQuote ? `"${escaped}"` : value}`);
  }

  let out = next.join("\n");
  if (trailingNewline && !out.endsWith("\n")) out += "\n";

  fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
  fs.writeFileSync(ENV_FILE, out, "utf-8");
}

export interface LLMPatch {
  openaiApiKey?: string | null;
  openaiBaseUrl?: string | null;
  openaiApiMode?: string | null;
  chatModel?: string | null;
  embeddingModel?: string | null;
  embeddingModelSize?: string | null;
}

export async function updateLLMConfig(patch: LLMPatch): Promise<LLMRuntimeConfig> {
  const updates: Record<RuntimeKey, string | null> = {} as Record<RuntimeKey, string | null>;
  if (patch.openaiApiKey !== undefined) {
    const v = patch.openaiApiKey?.trim() ?? "";
    overrides.set("OPENAI_API_KEY", v.length > 0 ? v : null);
    updates.OPENAI_API_KEY = v.length > 0 ? v : null;
  }
  if (patch.openaiBaseUrl !== undefined) {
    const v = patch.openaiBaseUrl?.trim() ?? "";
    overrides.set("OPENAI_BASE_URL", v.length > 0 ? v : null);
    updates.OPENAI_BASE_URL = v.length > 0 ? v : null;
  }
  if (patch.openaiApiMode !== undefined) {
    const v = (patch.openaiApiMode ?? "chat_completions").trim();
    overrides.set("OPENAI_API_MODE", v.length > 0 ? v : "chat_completions");
    updates.OPENAI_API_MODE = v.length > 0 ? v : "chat_completions";
  }
  if (patch.chatModel !== undefined) {
    const v = patch.chatModel?.trim() ?? "";
    overrides.set("MODEL", v.length > 0 ? v : null);
    updates.MODEL = v.length > 0 ? v : null;
  }
  if (patch.embeddingModel !== undefined) {
    const v = patch.embeddingModel?.trim() ?? "";
    overrides.set("EMBEDDING_MODEL", v.length > 0 ? v : null);
    updates.EMBEDDING_MODEL = v.length > 0 ? v : null;
  }
  if (patch.embeddingModelSize !== undefined) {
    const v = patch.embeddingModelSize?.trim() ?? "";
    overrides.set("EMBEDDING_MODEL_SIZE", v.length > 0 ? v : null);
    updates.EMBEDDING_MODEL_SIZE = v.length > 0 ? v : null;
  }

  applyToProcess(updates);

  try {
    writeEnvFile(updates);
  } catch (err) {
    console.error("[llm-config] failed to persist .env", err);
  }

  return getLLMConfig();
}
