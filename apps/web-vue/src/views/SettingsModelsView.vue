<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import SectionCard from "@/components/SectionCard.vue";
import {
  deleteWorkspaceProviderKey,
  fetchWorkspaceModelSettings,
  setWorkspaceProviderKey,
  updateWorkspaceEmbeddingConfig,
  updateWorkspaceModel,
  updateWorkspaceRerankConfig,
  type WorkspaceModelSettings,
} from "@/lib/api";

const settings = ref<WorkspaceModelSettings | null>(null);
const error = ref("");
const savingKey = ref("");

const providerForm = ref({
  providerType: "openai",
  apiKey: "",
  baseUrl: "",
  apiMode: "chat_completions",
});

const modelForms = ref<Record<string, string>>({
  chat: "",
  memory: "",
  search: "",
});

const embeddingForm = ref({
  modelId: "",
  dimensions: "",
});

const rerankForm = ref({
  provider: "none",
  modelId: "",
  threshold: "0.30",
});

const useCases = [
  {
    key: "chat",
    label: "聊天回复模型",
    description: "你和 AI 正常对话时使用的主模型。",
    placeholder: "openai/gpt-5-mini-2025-08-07",
  },
  {
    key: "memory",
    label: "记忆抽取模型",
    description: "把对话、笔记整理成知识时使用的模型。",
    placeholder: "openai/gpt-5-mini-2025-08-07",
  },
  {
    key: "search",
    label: "检索路由模型",
    description: "搜索拆解、召回组织与上下文拼装时使用的模型。",
    placeholder: "openai/gpt-5-mini-2025-08-07",
  },
];

const openaiStatus = computed(() => {
  return (
    settings.value?.keyStatus.find((item) => item.providerType === "openai") ?? null
  );
});

const chatSuggestions = computed(() => {
  return settings.value?.chatModels ?? [];
});

const embeddingSuggestions = computed(() => {
  return settings.value?.embeddingModels ?? [];
});

function syncFormsFromSettings() {
  providerForm.value.baseUrl = openaiStatus.value?.baseUrl ?? "https://api.pie-xian.com";
  providerForm.value.apiMode = openaiStatus.value?.apiMode ?? "chat_completions";

  modelForms.value = {
    chat: settings.value?.modelConfig.chat?.modelId ?? "openai/gpt-5-mini-2025-08-07",
    memory:
      settings.value?.modelConfig.memory?.modelId ?? "openai/gpt-5-mini-2025-08-07",
    search:
      settings.value?.modelConfig.search?.modelId ?? "openai/gpt-5-mini-2025-08-07",
  };

  embeddingForm.value = {
    modelId:
      settings.value?.embeddingConfig.modelId || "openai/text-embedding-3-small",
    dimensions:
      settings.value?.embeddingConfig.dimensions !== null &&
      settings.value?.embeddingConfig.dimensions !== undefined
        ? String(settings.value.embeddingConfig.dimensions)
        : "",
  };

  rerankForm.value = {
    provider: settings.value?.rerankConfig.provider || "none",
    modelId: settings.value?.rerankConfig.modelId || "",
    threshold:
      settings.value?.rerankConfig.threshold !== null &&
      settings.value?.rerankConfig.threshold !== undefined
        ? String(settings.value.rerankConfig.threshold)
        : "0.30",
  };
}

async function loadSettings() {
  try {
    settings.value = await fetchWorkspaceModelSettings();
    syncFormsFromSettings();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "加载模型设置失败。";
  }
}

async function saveProviderConfig() {
  if (!providerForm.value.apiKey.trim()) {
    error.value = "请先填写 API Key。";
    return;
  }

  savingKey.value = "provider";
  error.value = "";

  try {
    await setWorkspaceProviderKey({
      providerType: providerForm.value.providerType,
      apiKey: providerForm.value.apiKey.trim(),
      baseUrl: providerForm.value.baseUrl.trim(),
      apiMode: providerForm.value.apiMode,
    });
    providerForm.value.apiKey = "";
    await loadSettings();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "保存模型连接失败。";
  } finally {
    savingKey.value = "";
  }
}

async function removeProviderConfig() {
  savingKey.value = "provider-delete";
  error.value = "";

  try {
    await deleteWorkspaceProviderKey("openai");
    await loadSettings();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "删除模型连接失败。";
  } finally {
    savingKey.value = "";
  }
}

async function saveUseCaseModel(useCase: string) {
  const modelId = modelForms.value[useCase]?.trim();
  if (!modelId) {
    error.value = "请填写模型 ID。";
    return;
  }

  savingKey.value = `model-${useCase}`;
  error.value = "";

  try {
    await updateWorkspaceModel(useCase, modelId);
    await loadSettings();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "保存用途模型失败。";
  } finally {
    savingKey.value = "";
  }
}

async function saveEmbeddingConfig() {
  const modelId = embeddingForm.value.modelId.trim();
  if (!modelId) {
    error.value = "请填写嵌入模型 ID。";
    return;
  }

  savingKey.value = "embedding";
  error.value = "";

  try {
    await updateWorkspaceEmbeddingConfig({
      modelId,
      dimensions: embeddingForm.value.dimensions.trim()
        ? Number(embeddingForm.value.dimensions.trim())
        : null,
    });
    await loadSettings();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "保存嵌入模型失败。";
  } finally {
    savingKey.value = "";
  }
}

async function saveRerankConfig() {
  savingKey.value = "rerank";
  error.value = "";

  try {
    await updateWorkspaceRerankConfig({
      provider: rerankForm.value.provider,
      modelId: rerankForm.value.modelId.trim() || undefined,
      threshold: rerankForm.value.threshold.trim()
        ? Number(rerankForm.value.threshold.trim())
        : null,
    });
    await loadSettings();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "保存重排序配置失败。";
  } finally {
    savingKey.value = "";
  }
}

onMounted(() => {
  void loadSettings();
});
</script>

<template>
  <div class="settings-page">
    <SectionCard title="接入方式" eyebrow="当前优先走 OpenAI-compatible 聊天接法">
      <p class="settings-copy">
        现在这套系统不需要你再单独配一层 “Agent 模式”。最实用的方式是直接按
        OpenAI-compatible 模型接法来配，聊天、记忆抽取、搜索路由都会复用这层。
      </p>
      <p class="settings-copy">
        这套工作区当前可直接使用的模型是：
        `openai/gpt-5-mini-2025-08-07` 用于聊天与知识抽取，
        `openai/text-embedding-3-small` 用于向量检索。
        重排序先保持可选，不强制启用。
      </p>

      <p v-if="error" class="status status--error">{{ error }}</p>

      <div class="config-card">
        <div class="config-card__head">
          <div>
            <h4>OpenAI-Compatible 连接</h4>
            <p>适用于 `https://api.pie-xian.com` 这类兼容 OpenAI 协议的模型网关。</p>
          </div>
          <div class="config-card__status">
            <span class="chip" v-if="openaiStatus?.hasKey">已配置 Key</span>
            <span class="chip" v-else>未配置 Key</span>
            <span class="chip chip--accent">
              {{ openaiStatus?.apiMode || providerForm.apiMode }}
            </span>
          </div>
        </div>

        <div class="config-grid">
          <input
            v-model="providerForm.baseUrl"
            class="input"
            placeholder="https://api.pie-xian.com"
          />
          <select v-model="providerForm.apiMode" class="select">
            <option value="chat_completions">chat_completions</option>
            <option value="responses">responses</option>
          </select>
          <input
            v-model="providerForm.apiKey"
            class="input"
            type="password"
            placeholder="粘贴聊天/主模型 API Key"
          />
        </div>

        <div class="config-actions">
          <button class="button" :disabled="savingKey === 'provider'" @click="saveProviderConfig">
            {{ savingKey === "provider" ? "保存中..." : "保存连接" }}
          </button>
          <button
            class="button button--ghost"
            :disabled="savingKey === 'provider-delete'"
            @click="removeProviderConfig"
          >
            {{ savingKey === "provider-delete" ? "删除中..." : "删除连接" }}
          </button>
        </div>

        <p class="config-hint">
          当前更推荐 `chat_completions`。很多代理地址并不支持 `responses`，如果聊天提示模型不可达，先从这里排查。
        </p>
      </div>
    </SectionCard>

    <SectionCard title="用途模型" eyebrow="分别指定聊天、记忆抽取和搜索路由模型">
      <div class="settings-list">
        <article v-for="useCase in useCases" :key="useCase.key" class="settings-list__item settings-list__item--stack">
          <div>
            <h4>{{ useCase.label }}</h4>
            <p>{{ useCase.description }}</p>
          </div>

          <div class="model-editor">
            <input
              v-model="modelForms[useCase.key]"
              class="input"
              :placeholder="useCase.placeholder"
              :list="`models-${useCase.key}`"
            />
            <datalist :id="`models-${useCase.key}`">
              <option
                v-for="model in chatSuggestions"
                :key="`${useCase.key}-${model.id}`"
                :value="`${model.provider.type}/${model.modelId}`"
              >
                {{ model.label || model.modelId }}
              </option>
            </datalist>
            <button
              class="button button--ghost"
              :disabled="savingKey === `model-${useCase.key}`"
              @click="saveUseCaseModel(useCase.key)"
            >
              {{ savingKey === `model-${useCase.key}` ? "保存中..." : "保存模型" }}
            </button>
          </div>
        </article>
      </div>
    </SectionCard>

    <SectionCard title="向量检索" eyebrow="嵌入模型会直接影响记忆搜索与入图质量">
      <div class="config-card">
        <div class="config-grid config-grid--embedding">
          <input
            v-model="embeddingForm.modelId"
            class="input"
            list="embedding-models"
            placeholder="openai/text-embedding-3-small"
          />
          <datalist id="embedding-models">
            <option
              v-for="model in embeddingSuggestions"
              :key="model.id"
              :value="`${model.provider.type}/${model.modelId}`"
            >
              {{ model.label || model.modelId }}
            </option>
          </datalist>

          <input
            v-model="embeddingForm.dimensions"
            class="input"
            placeholder="向量维度，例如 1024 / 1536 / 2560"
          />
        </div>

        <div class="config-actions">
          <button class="button" :disabled="savingKey === 'embedding'" @click="saveEmbeddingConfig">
            {{ savingKey === "embedding" ? "保存中..." : "保存嵌入配置" }}
          </button>
        </div>

        <p class="config-hint">
          如果你要切到 `qwen3-embedding-4b`，建议把真实向量维度一起填上。否则系统会继续沿用当前默认维度，容易导致检索或入库存储不匹配。
        </p>
      </div>
    </SectionCard>

    <SectionCard title="重排序" eyebrow="先给你留好位置，便于后面继续收口检索质量">
      <div class="config-card">
        <div class="config-grid">
          <select v-model="rerankForm.provider" class="select">
            <option value="none">先关闭重排序</option>
            <option value="openai">OpenAI-Compatible 预留</option>
          </select>
          <input
            v-model="rerankForm.modelId"
            class="input"
            placeholder="openai/qwen3-reranker-4b"
          />
          <input
            v-model="rerankForm.threshold"
            class="input"
            placeholder="阈值，例如 0.30"
          />
        </div>

        <div class="config-actions">
          <button class="button" :disabled="savingKey === 'rerank'" @click="saveRerankConfig">
            {{ savingKey === "rerank" ? "保存中..." : "保存重排序配置" }}
          </button>
        </div>

        <p class="config-hint">
          这一项我先把配置位给你做好。当前核心优先级还是先让聊天模型和嵌入模型跑通，重排序会是下一步继续提检索质量的抓手。
        </p>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-copy,
.config-hint {
  margin: 0;
  color: var(--text-soft);
}

.config-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 250, 244, 0.84);
  border: 1px solid rgba(95, 64, 28, 0.12);
}

.config-card__head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.config-card__head h4 {
  margin: 0 0 4px;
}

.config-card__head p {
  margin: 0;
  color: var(--text-soft);
}

.config-card__status {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.config-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 10px;
}

.config-grid--embedding {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
}

.config-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.settings-list__item--stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.model-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

@media (max-width: 1080px) {
  .config-card__head,
  .config-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .config-card__status {
    justify-content: flex-start;
  }

  .config-grid,
  .config-grid--embedding,
  .model-editor {
    grid-template-columns: 1fr;
  }
}
</style>
