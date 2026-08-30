import { json } from "~/lib/remix-compat";

const USE_CASES = ["chat", "memory", "search"] as const;

export async function loader() {
  // Personal system: return default model config without DB lookup
  const modelConfig: Record<string, { modelId: string } | undefined> = {};
  for (const uc of USE_CASES) {
    modelConfig[uc] = { modelId: "mock/default" };
  }

  return json({
    modelConfig,
    embeddingConfig: { modelId: "", dimensions: null },
    rerankConfig: { provider: "none", modelId: "", threshold: null },
    keyStatus: {},
    models: [],
    chatModels: [],
    embeddingModels: [],
  });
}

export async function action() {
  return json({ success: true });
}
