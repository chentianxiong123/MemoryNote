import { type Prisma } from "@prisma/client";

import { prisma } from "~/db.server";
import {
  decryptSecret,
  encryptSecret,
  EncryptedSecretSchema,
  type EncryptedSecret,
} from "~/lib/encryption.server";

export type SupportedProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "azure"
  | "ollama"
  | "openrouter"
  | "deepseek"
  | "vercel"
  | "groq"
  | "mistral"
  | "xai";

export type ProviderApiMode = "responses" | "chat_completions";

export interface BYOKConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  apiMode?: ProviderApiMode;
  models?: Array<{ id: string; name: string }>;
}

export interface WorkspaceKeyStatus {
  providerType: SupportedProvider;
  hasKey: boolean;
  keyPrefix: string | null;
  baseUrl?: string | null;
  apiMode?: ProviderApiMode | null;
}

type WorkspaceProviderConfig = {
  apiKeyEncrypted?: EncryptedSecret;
  keyPrefix?: string | null;
  baseUrl?: string | null;
  apiMode?: ProviderApiMode | null;
};

const SUPPORTED_PROVIDERS: SupportedProvider[] = [
  "openai",
  "anthropic",
  "google",
  "azure",
  "ollama",
  "openrouter",
  "deepseek",
  "vercel",
  "groq",
  "mistral",
  "xai",
];

function normalizeProviderBaseUrl(
  provider: SupportedProvider,
  baseUrl?: string | null,
): string | undefined {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return undefined;

  if (provider !== "openai") {
    return trimmed.replace(/\/+$/, "");
  }

  const normalized = trimmed.replace(/\/+$/, "");
  try {
    const url = new URL(normalized);
    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = "/v1";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return normalized;
  }
}

function normalizeApiMode(
  provider: SupportedProvider,
  apiMode?: string | null,
  hasBaseUrl?: boolean,
): ProviderApiMode | undefined {
  if (provider !== "openai") return undefined;

  if (apiMode === "responses" || apiMode === "chat_completions") {
    return apiMode;
  }

  return hasBaseUrl ? "chat_completions" : "responses";
}

function obfuscateKeyPrefix(apiKey: string): string {
  const trimmed = apiKey.trim();
  const visible = trimmed.slice(0, Math.min(8, trimmed.length));
  return visible.length > 0 ? `${visible}********` : "********";
}

function parseWorkspaceProviderConfig(
  config: Prisma.JsonValue | null | undefined,
): WorkspaceProviderConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  const raw = config as Record<string, unknown>;
  const encrypted = EncryptedSecretSchema.safeParse(raw.apiKeyEncrypted);

  return {
    apiKeyEncrypted: encrypted.success ? encrypted.data : undefined,
    keyPrefix:
      typeof raw.keyPrefix === "string" && raw.keyPrefix.length > 0
        ? raw.keyPrefix
        : null,
    baseUrl:
      typeof raw.baseUrl === "string" && raw.baseUrl.length > 0
        ? raw.baseUrl
        : null,
    apiMode:
      raw.apiMode === "responses" || raw.apiMode === "chat_completions"
        ? raw.apiMode
        : null,
  };
}

function toProviderConfigJson(
  config: WorkspaceProviderConfig,
): Prisma.InputJsonValue {
  return {
    ...(config.apiKeyEncrypted ? { apiKeyEncrypted: config.apiKeyEncrypted } : {}),
    ...(config.keyPrefix ? { keyPrefix: config.keyPrefix } : {}),
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    ...(config.apiMode ? { apiMode: config.apiMode } : {}),
  } as Prisma.InputJsonValue;
}

async function getWorkspaceProviderRecord(
  _workspaceId: string,
  provider: SupportedProvider | string,
) {
  return prisma.lLMProvider.findFirst({
    where: {
      type: provider,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function isSupportedProvider(provider: string): provider is SupportedProvider {
  return SUPPORTED_PROVIDERS.includes(provider as SupportedProvider);
}

export async function getWorkspaceKeyStatus(
  _workspaceId?: string,
): Promise<WorkspaceKeyStatus[]> {
  const providers = await prisma.lLMProvider.findMany({
    where: {
      isActive: true,
      type: { in: SUPPORTED_PROVIDERS },
    },
    orderBy: { type: "asc" },
  });

  return providers
    .map((provider) => {
      const config = parseWorkspaceProviderConfig(provider.config);
      return {
        providerType: provider.type as SupportedProvider,
        hasKey: !!config.apiKeyEncrypted,
        keyPrefix: config.keyPrefix ?? null,
        baseUrl: config.baseUrl ?? null,
        apiMode: config.apiMode ?? null,
      };
    })
    .filter((provider) => provider.hasKey || provider.baseUrl || provider.apiMode);
}

export async function setWorkspaceApiKey(
  workspaceId: string,
  provider: SupportedProvider,
  apiKey: string,
  baseUrl?: string,
  apiMode?: string,
): Promise<void> {
  const existing = await getWorkspaceProviderRecord(workspaceId, provider);
  const normalizedBaseUrl = normalizeProviderBaseUrl(provider, baseUrl);
  const normalizedApiMode = normalizeApiMode(
    provider,
    apiMode,
    !!normalizedBaseUrl,
  );

  const nextConfig: WorkspaceProviderConfig = {
    ...parseWorkspaceProviderConfig(existing?.config),
    apiKeyEncrypted: encryptSecret(apiKey.trim()),
    keyPrefix: obfuscateKeyPrefix(apiKey),
    baseUrl: normalizedBaseUrl ?? null,
    apiMode: normalizedApiMode ?? null,
  };

  if (existing) {
    await prisma.lLMProvider.update({
      where: { id: existing.id },
      data: {
        name: existing.name,
        isActive: true,
        config: toProviderConfigJson(nextConfig),
      },
    });
    return;
  }

  await prisma.lLMProvider.create({
    data: {
      name: provider === "openai" ? "OpenAI Compatible" : provider,
      type: provider,
      isActive: true,
      config: toProviderConfigJson(nextConfig),
    },
  });
}

export async function deleteWorkspaceApiKey(
  _workspaceId: string,
  provider: SupportedProvider,
): Promise<void> {
  // Personal use: find and delete by type only
  const target = await prisma.lLMProvider.findFirst({
    where: { type: provider, isActive: true },
  });
  if (target) {
    await prisma.lLMProvider.delete({ where: { id: target.id } });
  }
}

export async function getBYOKConfig(userId: string): Promise<BYOKConfig | null> {
  // Personal use: skip userWorkspace lookup, query LLMProvider directly
  const record = await prisma.lLMProvider.findFirst({
    where: {
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return null;

  const config = parseWorkspaceProviderConfig(record.config);
  if (!config.apiKeyEncrypted) return null;

  return {
    provider: record.type,
    apiKey: decryptSecret(config.apiKeyEncrypted),
    baseUrl: config.baseUrl ?? undefined,
    apiMode: config.apiMode ?? undefined,
  };
}

export async function saveBYOKConfig(
  userId: string,
  config: BYOKConfig,
): Promise<void> {
  // Personal use: skip userWorkspace lookup
  if (!isSupportedProvider(config.provider)) return;
  // For personal use, just update or create the first active provider of the type
  const existing = await prisma.lLMProvider.findFirst({
    where: { type: config.provider, isActive: true },
  });
  const normalizedBaseUrl = normalizeProviderBaseUrl(config.provider as SupportedProvider, config.baseUrl);
  const normalizedApiMode = normalizeApiMode(config.provider as SupportedProvider, config.apiMode, !!normalizedBaseUrl);
  const nextConfig: WorkspaceProviderConfig = {
    apiKeyEncrypted: encryptSecret(config.apiKey.trim()),
    keyPrefix: obfuscateKeyPrefix(config.apiKey),
    baseUrl: normalizedBaseUrl ?? null,
    apiMode: normalizedApiMode ?? null,
  };
  if (existing) {
    await prisma.lLMProvider.update({
      where: { id: existing.id },
      data: { config: toProviderConfigJson(nextConfig) },
    });
  } else {
    await prisma.lLMProvider.create({
      data: {
        name: config.provider === "openai" ? "OpenAI Compatible" : config.provider,
        type: config.provider,
        isActive: true,
        config: toProviderConfigJson(nextConfig),
      },
    });
  }
}

export async function deleteBYOKConfig(userId: string): Promise<void> {
  // Personal use: skip userWorkspace lookup
  await prisma.lLMProvider.deleteMany({
    where: { isActive: true },
  });
}

export async function hasBYOKConfig(userId: string): Promise<boolean> {
  const config = await getBYOKConfig(userId);
  return !!config;
}

export async function isWorkspaceBYOK(_workspaceId?: string): Promise<boolean> {
  // Personal use: check if any BYOK provider exists
  const count = await prisma.lLMProvider.count({
    where: {
      isActive: true,
      type: { in: SUPPORTED_PROVIDERS },
    },
  });

  return count > 0;
}

export async function resolveWorkspaceApiKey(
  workspaceId: string,
  provider: SupportedProvider | string,
): Promise<string | null> {
  const record = await getWorkspaceProviderRecord(workspaceId, provider);
  const config = parseWorkspaceProviderConfig(record?.config);
  return config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : null;
}

export async function resolveWorkspaceProviderBaseUrl(
  workspaceId: string,
  provider: SupportedProvider | string,
): Promise<string | null> {
  const record = await getWorkspaceProviderRecord(workspaceId, provider);
  const config = parseWorkspaceProviderConfig(record?.config);
  return config.baseUrl ?? null;
}

export async function resolveWorkspaceProviderApiMode(
  workspaceId: string,
  provider: SupportedProvider | string,
): Promise<ProviderApiMode | null> {
  const record = await getWorkspaceProviderRecord(workspaceId, provider);
  const config = parseWorkspaceProviderConfig(record?.config);
  return config.apiMode ?? null;
}
