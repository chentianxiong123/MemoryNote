<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import SectionCard from "@/components/SectionCard.vue";
import {
  createConversation,
  fetchConversation,
  fetchConversations,
  fetchModels,
  fetchWorkspaceModelSettings,
  triggerConversationResponse,
  type ConversationDetail,
  type ConversationSummary,
  type ModelOption,
  type WorkspaceModelSettings,
} from "@/lib/api";

const route = useRoute();
const router = useRouter();

const conversations = ref<ConversationSummary[]>([]);
const currentConversation = ref<ConversationDetail | null>(null);
const models = ref<ModelOption[]>([]);
const selectedModelId = ref("");
const draft = ref("");
const search = ref("");
const isLoading = ref(false);
const isSending = ref(false);
const error = ref("");
const isSearching = ref(false);
const workspaceSettings = ref<WorkspaceModelSettings | null>(null);
const latestCaptureBatch = ref<{
  id: string;
  summary: string;
  createdAt: string;
  itemCount: number;
  proposedCount: number;
} | null>(null);
let searchTimer: ReturnType<typeof window.setTimeout> | undefined;

const conversationId = computed(() => route.params.conversationId as string | undefined);
const hasConfiguredProviderKey = computed(() =>
  (workspaceSettings.value?.keyStatus ?? []).some((item) => item.hasKey),
);
const hasDefaultChatModel = computed(() => {
  const chatEntry = workspaceSettings.value?.modelConfig?.chat;
  return Boolean(chatEntry?.modelId);
});
const setupWarning = computed(() => {
  if (!workspaceSettings.value) return "";
  if (!hasConfiguredProviderKey.value) {
    return "当前工作区还没有配置可用的模型 Key，对话回复和自动知识 recap 现在都不会成功。";
  }
  if (!hasDefaultChatModel.value) {
    return "当前工作区还没有设置默认聊天模型。你可以继续手动选模型，但建议先在模型设置里补上默认项。";
  }
  return "";
});

function textFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n");
}

function formatDateTime(value?: string) {
  if (!value) return "刚刚";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadConversations() {
  isSearching.value = true;
  try {
    const response = await fetchConversations(search.value);
    conversations.value = response.conversations;
  } finally {
    isSearching.value = false;
  }
}

async function loadCurrentConversation() {
  if (!conversationId.value) {
    currentConversation.value = null;
    return;
  }

  currentConversation.value = await fetchConversation(conversationId.value);
}

async function bootstrap() {
  isLoading.value = true;
  error.value = "";

  try {
    const [conversationResult, modelResult, settings] = await Promise.all([
      fetchConversations(),
      fetchModels(),
      fetchWorkspaceModelSettings(),
    ]);

    conversations.value = conversationResult.conversations;
    models.value = modelResult;
    workspaceSettings.value = settings;
    selectedModelId.value =
      modelResult.find((model) => model.isDefault)?.id ?? modelResult[0]?.id ?? "";

    await loadCurrentConversation();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "加载对话空间失败。";
  } finally {
    isLoading.value = false;
  }
}

async function submitMessage() {
  const message = draft.value.trim();
  if (!message || isSending.value) return;

  isSending.value = true;
  error.value = "";

  try {
    let targetConversationId = conversationId.value;

    if (!targetConversationId) {
      const created = await createConversation(message);
      targetConversationId = created.conversationId;
      await router.push(`/home/conversation/${targetConversationId}`);
      currentConversation.value = await fetchConversation(targetConversationId);
    } else if (currentConversation.value) {
      currentConversation.value = {
        ...currentConversation.value,
        ConversationHistory: [
          ...currentConversation.value.ConversationHistory,
          {
            id: `temp-${Date.now()}`,
            role: "user",
            createdAt: new Date().toISOString(),
            parts: [{ type: "text", text: message }],
          },
        ],
      };
    }

    if (!targetConversationId) {
      throw new Error("创建会话失败。");
    }

    draft.value = "";

    const reply = await triggerConversationResponse(
      targetConversationId,
      message,
      selectedModelId.value || undefined,
    );

    latestCaptureBatch.value = reply.knowledgeCaptureBatch ?? null;

    if (reply.conversation) {
      currentConversation.value = reply.conversation;
    } else {
      await loadCurrentConversation();
    }

    await loadConversations();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "发送消息失败。";
  } finally {
    isSending.value = false;
  }
}

onMounted(() => {
  void bootstrap();
});

watch(
  () => route.params.conversationId,
  () => {
    void loadCurrentConversation();
  },
);

watch(search, () => {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
  }

  searchTimer = window.setTimeout(() => {
    void loadConversations();
  }, 240);
});
</script>

<template>
  <div class="conversation-view">
    <SectionCard title="会话列表" eyebrow="围绕个人知识成长保留上下文">
      <div class="toolbar">
        <input
          v-model="search"
          class="input"
          placeholder="搜索会话标题"
        />
        <button class="button button--ghost" @click="router.push('/home/conversation')">
          新建对话
        </button>
      </div>

      <div class="conversation-list">
        <div v-if="isLoading || isSearching" class="empty-state">
          <p>正在加载会话...</p>
        </div>
        <div v-else-if="conversations.length === 0" class="empty-state">
          <p>{{ search ? "没有匹配的会话。" : "还没有对话，先发一条消息开始吧。" }}</p>
        </div>
        <button
          v-for="conversation in conversations"
          :key="conversation.id"
          class="conversation-list__item"
          :class="{ 'conversation-list__item--active': conversation.id === conversationId }"
          @click="router.push(`/home/conversation/${conversation.id}`)"
        >
          <div class="conversation-list__meta">
            <span>{{ conversation.title || "未命名会话" }}</span>
            <small>{{ formatDateTime(conversation.updatedAt) }}</small>
          </div>
          <small>{{ conversation.status || "就绪" }}</small>
        </button>
      </div>
    </SectionCard>

    <SectionCard title="对话内容" eyebrow="先保证稳定可用，再逐步恢复自动记忆与入图">
      <p class="conversation-note">
        对话是主工作区。如果这里提示模型不可达，优先去「模型设置」检查提供商地址和 Key。
        每轮回复结束后，系统会把可沉淀的知识整理成一组候选项，放到知识工作台里等待你确认。
      </p>
      <div v-if="setupWarning" class="conversation-warning">
        <strong>模型配置未完成</strong>
        <p>{{ setupWarning }}</p>
        <button class="button button--ghost" @click="router.push('/settings/workspace/models')">
          去模型设置
        </button>
      </div>

      <div class="thread">
        <article v-if="latestCaptureBatch" class="thread__bubble thread__bubble--capture">
          <p class="thread__role">本轮学习 recap</p>
          <p class="thread__text">{{ latestCaptureBatch.summary }}</p>
          <small class="thread__time">
            {{ latestCaptureBatch.proposedCount }} 项待确认 · {{ formatDateTime(latestCaptureBatch.createdAt) }}
          </small>
          <div class="composer__actions">
            <button class="button button--ghost" @click="router.push('/home/memory/graph/inbox')">
              去知识工作台处理
            </button>
          </div>
        </article>

        <template v-if="conversationId && currentConversation">
          <article
            v-for="entry in currentConversation.ConversationHistory"
            :key="entry.id"
            class="thread__bubble"
            :class="entry.role === 'assistant' ? 'thread__bubble--assistant' : 'thread__bubble--user'"
          >
            <p class="thread__role">{{ entry.role === "assistant" ? "MemoryNote" : "你" }}</p>
            <p class="thread__text">{{ textFromParts(entry.parts) || "暂不支持展示该内容块。" }}</p>
            <small class="thread__time">{{ formatDateTime(entry.createdAt) }}</small>
          </article>
        </template>
        <div v-else class="empty-state">
          <p>先发一条消息，从对话开始积累你的个人知识。</p>
        </div>
      </div>

      <div class="composer">
        <select v-model="selectedModelId" class="select">
          <option v-for="model in models" :key="model.id" :value="model.id">
            {{ model.label || model.modelId }}
          </option>
        </select>
        <textarea
          v-model="draft"
          class="textarea"
          rows="4"
          placeholder="输入你的问题、待整理的思路，或想沉淀成知识的内容..."
        />
        <div class="composer__actions">
          <span v-if="error" class="status status--error">{{ error }}</span>
          <span v-else-if="isLoading || isSending" class="status">处理中...</span>
          <button class="button" :disabled="isSending || !draft.trim()" @click="submitMessage">
            {{ isSending ? "发送中..." : "发送消息" }}
          </button>
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
.conversation-note {
  margin: 0;
  color: var(--text-soft);
}

.conversation-warning {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(201, 99, 61, 0.24);
  background: rgba(201, 99, 61, 0.1);
}

.conversation-warning p {
  margin: 0;
  color: var(--text-soft);
}

.thread__bubble--capture {
  background: rgba(47, 125, 128, 0.1);
  border-color: rgba(47, 125, 128, 0.18);
}
</style>
