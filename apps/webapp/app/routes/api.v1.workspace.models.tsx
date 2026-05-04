import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Prisma } from "@prisma/client";

import { requireUser } from "~/services/session.server";
import { prisma } from "~/db.server";
import {
  getAvailableModels,
  getChatModels,
} from "~/services/llm-provider.server";
import {
  getWorkspaceKeyStatus,
  setWorkspaceApiKey,
  deleteWorkspaceApiKey,
  isSupportedProvider,
  type SupportedProvider,
} from "~/services/byok.server";

const USE_CASES = ["chat", "memory", "search"] as const;
type UseCase = (typeof USE_CASES)[number];

type WorkspaceMetadata = Record<string, unknown> & {
  modelConfig?: Record<UseCase, { modelId: string } | undefined>;
  embeddingConfig?: {
    modelId?: string;
    dimensions?: number | null;
  };
  rerankConfig?: {
    provider?: string;
    modelId?: string;
    threshold?: number | null;
  };
};

function extractMetadataConfig(metadata: Prisma.JsonValue | null) {
  const safeMetadata = ((metadata as WorkspaceMetadata | null) ?? {}) as WorkspaceMetadata;

  return {
    metadata: safeMetadata,
    modelConfig: (safeMetadata.modelConfig ?? {}) as Record<
      UseCase,
      { modelId: string } | undefined
    >,
    embeddingConfig: {
      modelId:
        typeof safeMetadata.embeddingConfig?.modelId === "string"
          ? safeMetadata.embeddingConfig.modelId
          : "",
      dimensions:
        typeof safeMetadata.embeddingConfig?.dimensions === "number"
          ? safeMetadata.embeddingConfig.dimensions
          : null,
    },
    rerankConfig: {
      provider:
        typeof safeMetadata.rerankConfig?.provider === "string"
          ? safeMetadata.rerankConfig.provider
          : "none",
      modelId:
        typeof safeMetadata.rerankConfig?.modelId === "string"
          ? safeMetadata.rerankConfig.modelId
          : "",
      threshold:
        typeof safeMetadata.rerankConfig?.threshold === "number"
          ? safeMetadata.rerankConfig.threshold
          : null,
    },
  };
}

function serializeModel(model: Awaited<ReturnType<typeof getAvailableModels>>[number]) {
  return {
    id: `${model.provider.type}/${model.modelId}`,
    modelId: model.modelId,
    label: model.label,
    provider: {
      type: model.provider.type,
      name: model.provider.name,
    },
    complexity: model.complexity,
    supportsBatch: model.supportsBatch,
    capabilities: model.capabilities,
    isDefault: false,
    dimensions: model.dimensions ?? null,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);

  if (!user.workspaceId) {
    return json({ error: "Workspace not found" }, { status: 404 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { metadata: true },
  });

  const { modelConfig, embeddingConfig, rerankConfig } = extractMetadataConfig(
    workspace?.metadata as Prisma.JsonValue | null,
  );

  const [chatModels, availableModels, keyStatus] = await Promise.all([
    getChatModels(user.workspaceId),
    getAvailableModels(user.workspaceId),
    getWorkspaceKeyStatus(user.workspaceId),
  ]);

  const allModels = availableModels.map(serializeModel);
  const chatModelIds = new Set(chatModels.map((model) => model.modelId));

  return json({
    modelConfig,
    embeddingConfig,
    rerankConfig,
    keyStatus,
    models: allModels,
    chatModels: allModels.filter((model) => chatModelIds.has(model.modelId)),
    embeddingModels: allModels.filter((model) =>
      model.capabilities.includes("embedding"),
    ),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (!user.workspaceId) {
    return json({ error: "Workspace not found" }, { status: 404 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { metadata: true },
  });

  const { metadata, modelConfig } = extractMetadataConfig(
    workspace?.metadata as Prisma.JsonValue | null,
  );

  if (intent === "updateModel") {
    const useCase = formData.get("useCase") as UseCase;
    const modelId = (formData.get("modelId") as string | null)?.trim();

    if (!USE_CASES.includes(useCase) || !modelId) {
      return json({ error: "Missing useCase or modelId" }, { status: 400 });
    }

    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: {
        metadata: {
          ...metadata,
          modelConfig: { ...modelConfig, [useCase]: { modelId } },
        } as Prisma.InputJsonValue,
      },
    });

    return json({ success: true });
  }

  if (intent === "updateEmbeddingConfig") {
    const modelId = (formData.get("modelId") as string | null)?.trim();
    const dimensionsValue = (formData.get("dimensions") as string | null)?.trim();

    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: {
        metadata: {
          ...metadata,
          embeddingConfig: modelId
            ? {
                modelId,
                ...(dimensionsValue ? { dimensions: Number(dimensionsValue) } : {}),
              }
            : null,
        } as Prisma.InputJsonValue,
      },
    });

    return json({ success: true });
  }

  if (intent === "updateRerankConfig") {
    const provider = (formData.get("provider") as string | null)?.trim() || "none";
    const modelId = (formData.get("modelId") as string | null)?.trim();
    const thresholdValue = (formData.get("threshold") as string | null)?.trim();

    await prisma.workspace.update({
      where: { id: user.workspaceId },
      data: {
        metadata: {
          ...metadata,
          rerankConfig:
            provider === "none" && !modelId
              ? null
              : {
                  provider,
                  ...(modelId ? { modelId } : {}),
                  ...(thresholdValue ? { threshold: Number(thresholdValue) } : {}),
                },
        } as Prisma.InputJsonValue,
      },
    });

    return json({ success: true });
  }

  if (intent === "setKey") {
    const providerType = formData.get("providerType") as string;
    const apiKey = (formData.get("apiKey") as string | null)?.trim();
    const baseUrl = (formData.get("baseUrl") as string | null)?.trim() || undefined;
    const apiMode = (formData.get("apiMode") as string | null)?.trim() || undefined;

    if (!isSupportedProvider(providerType)) {
      return json({ error: "Unsupported provider" }, { status: 400 });
    }

    if (!apiKey) {
      return json({ error: "API key is required" }, { status: 400 });
    }

    await setWorkspaceApiKey(
      user.workspaceId,
      providerType as SupportedProvider,
      apiKey,
      baseUrl,
      apiMode,
    );

    return json({ success: true });
  }

  if (intent === "deleteKey") {
    const providerType = formData.get("providerType") as string;

    if (!isSupportedProvider(providerType)) {
      return json({ error: "Unsupported provider" }, { status: 400 });
    }

    await deleteWorkspaceApiKey(
      user.workspaceId,
      providerType as SupportedProvider,
    );

    return json({ success: true });
  }

  return json({ error: "Invalid intent" }, { status: 400 });
}
