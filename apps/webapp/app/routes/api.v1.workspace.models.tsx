import { json } from "~/lib/remix-compat";
import { prisma } from "~/db.server";
import {
  getLLMConfig,
  updateLLMConfig,
  type LLMPatch,
} from "~/services/llm-config.server";

const USE_CASES = ["chat", "memory", "search"] as const;
const ALLOWED_INTENTS = [
  "setKey",
  "deleteKey",
  "updateModel",
  "updateEmbeddingConfig",
  "updateRerankConfig",
] as const;
type Intent = (typeof ALLOWED_INTENTS)[number];

async function ensureModelInDb(
  modelId: string,
  capability: "chat" | "embedding",
  dimensions?: number,
) {
  const existing = await prisma.lLMModel.findFirst({
    where: { modelId, capabilities: { has: capability } },
    include: { provider: true },
  });
  if (existing) {
    if (
      capability === "embedding" &&
      dimensions &&
      existing.dimensions !== dimensions
    ) {
      await prisma.lLMModel.update({
        where: { id: existing.id },
        data: { dimensions },
      });
    }
    return existing;
  }

  const provider =
    (await prisma.lLMProvider.findFirst({
      where: { type: "openai" },
    })) ??
    (await prisma.lLMProvider.create({
      data: {
        type: "openai",
        name: "OpenAI-Compatible",
        
        isActive: true,
      },
    }));

  return prisma.lLMModel.create({
    data: {
      providerId: provider.id,
      modelId,
      label: modelId,
      complexity: "medium",
      supportsBatch: false,
      capabilities: [capability],
      ...(capability === "embedding" ? { dimensions: dimensions ?? 1024 } : {}),
    },
  });
}

export async function loader() {
  const cfg = getLLMConfig();
  const modelConfig: Record<string, { modelId: string } | undefined> = {
    chat: { modelId: cfg.chatModel },
    memory: { modelId: cfg.chatModel },
    search: { modelId: cfg.chatModel },
  };

  const keyStatus = [
    {
      providerType: "openai",
      hasKey: !!cfg.openaiApiKey,
      keyPrefix: cfg.openaiApiKey,
      baseUrl: cfg.openaiBaseUrl,
      apiMode: cfg.openaiApiMode,
    },
  ];

  return json({
    modelConfig,
    embeddingConfig: {
      modelId: cfg.embeddingModel,
      dimensions: parseInt(cfg.embeddingModelSize, 10) || null,
    },
    rerankConfig: {
      provider: "none",
      modelId: "",
      threshold: null,
    },
    keyStatus,
    models: [],
    chatModels: [],
    embeddingModels: [],
  });
}

export async function action({ request }: { request: Request }) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const intent = body.intent as Intent | undefined;
  if (!intent || !ALLOWED_INTENTS.includes(intent)) {
    return json(
      { success: false, error: `Unknown intent: ${String(intent)}` },
      { status: 400 },
    );
  }

  const patch: LLMPatch = {};

  if (intent === "setKey") {
    const providerType = String(body.providerType ?? "openai");
    if (providerType !== "openai") {
      return json(
        { success: false, error: `Provider ${providerType} not editable in personal mode` },
        { status: 400 },
      );
    }
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
    if (!apiKey.trim()) {
      return json(
        { success: false, error: "API Key is required" },
        { status: 400 },
      );
    }
    patch.openaiApiKey = apiKey;
    if (typeof body.baseUrl === "string") patch.openaiBaseUrl = body.baseUrl;
    if (typeof body.apiMode === "string") patch.openaiApiMode = body.apiMode;
  } else if (intent === "deleteKey") {
    patch.openaiApiKey = null;
  } else if (intent === "updateModel") {
    const useCase = String(body.useCase ?? "chat");
    if (!USE_CASES.includes(useCase as (typeof USE_CASES)[number])) {
      return json(
        { success: false, error: `Unknown useCase: ${useCase}` },
        { status: 400 },
      );
    }
    const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
    if (!modelId) {
      return json(
        { success: false, error: "modelId is required" },
        { status: 400 },
      );
    }
    patch.chatModel = modelId;
    try {
      await ensureModelInDb(modelId, "chat");
    } catch (err) {
      console.error("[workspace.models] ensureModelInDb chat failed", err);
    }
  } else if (intent === "updateEmbeddingConfig") {
    const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
    if (!modelId) {
      return json(
        { success: false, error: "embedding modelId is required" },
        { status: 400 },
      );
    }
    patch.embeddingModel = modelId;
    const dimensions = body.dimensions;
    if (dimensions !== undefined && dimensions !== null && dimensions !== "") {
      const dim = Number(dimensions);
      if (Number.isFinite(dim) && dim > 0) {
        patch.embeddingModelSize = String(Math.round(dim));
      }
    }
    try {
      const dim = patch.embeddingModelSize
        ? parseInt(patch.embeddingModelSize, 10)
        : undefined;
      await ensureModelInDb(modelId, "embedding", dim);
    } catch (err) {
      console.error("[workspace.models] ensureModelInDb embedding failed", err);
    }
  } else if (intent === "updateRerankConfig") {
    // Personal mode: rerank stays disabled.
    return json({ success: true, rerankConfig: { provider: "none" } });
  }

  const next = await updateLLMConfig(patch);

  return json({
    success: true,
    config: {
      modelConfig: {
        chat: { modelId: next.chatModel },
        memory: { modelId: next.chatModel },
        search: { modelId: next.chatModel },
      },
      embeddingConfig: {
        modelId: next.embeddingModel,
        dimensions: parseInt(next.embeddingModelSize, 10) || null,
      },
      keyStatus: [
        {
          providerType: "openai",
          hasKey: !!next.openaiApiKey,
          keyPrefix: next.openaiApiKey,
          baseUrl: next.openaiBaseUrl,
          apiMode: next.openaiApiMode,
        },
      ],
    },
  });
}
