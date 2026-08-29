<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import {
  createConversation,
  triggerConversationResponse,
  fetchConversations,
  type ConversationDetail,
  type ConversationReplyResponse,
} from "@/lib/api";
import { useSessionStore } from "@/stores/session";

const router = useRouter();
const session = useSessionStore();

const conversations = ref<Array<{ id: string; title: string | null; updatedAt?: string }>>([]);
const activeConversationId = ref<string | null>(null);
const conversationHistory = ref<Array<{ id: string; role: string; text?: string }>>([]);
const message = ref("");
const isSending = ref(false);
const isLoading = ref(false);
const error = ref("");

async function loadConversations() {
  try {
    const response = await fetchConversations();
    conversations.value = response.conversations;
  } catch (err) {
    console.error("Failed to load conversations:", err);
  }
}

async function createNewConversation() {
  const text = message.value.trim();
  if (!text || isSending.value) return;

  isSending.value = true;
  error.value = "";

  try {
    const { conversationId } = await createConversation(text);
    message.value = "";
    activeConversationId.value = conversationId;
    await loadConversation(conversationId);
    await loadConversations();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "发送失败。";
  } finally {
    isSending.value = false;
  }
}

async function loadConversation(conversationId: string) {
  isLoading.value = true;
  try {
    const detail = await (await import("@/lib/api")).fetchConversation(conversationId);
    conversationHistory.value = detail.ConversationHistory.map((entry) => ({
      id: entry.id,
      role: entry.role,
      text: entry.parts?.find((p: any) => p.type === "text")?.text,
    }));
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载对话失败。";
  } finally {
    isLoading.value = false;
  }
}

async function sendReply() {
  if (!activeConversationId.value || !message.value.trim() || isSending.value) return;

  isSending.value = true;
  error.value = "";

  try {
    const response: ConversationReplyResponse = await triggerConversationResponse(
      activeConversationId.value,
      message.value.trim(),
    );
    message.value = "";
    await loadConversation(activeConversationId.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "发送失败。";
  } finally {
    isSending.value = false;
  }
}

function selectConversation(conversationId: string) {
  activeConversationId.value = conversationId;
  void loadConversation(conversationId);
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

const canSend = computed(() => message.value.trim() && !isSending.value);

onMounted(() => {
  void loadConversations();
});
</script>

<template>
  <div class="conversation-create">
    <div class="conversation-create__main">
      <!-- 消息输入区 -->
      <div class="composer">
        <div class="composer__input-wrap">
          <textarea
            v-model="message"
            class="composer__input"
            :placeholder="activeConversationId ? '继续对话...' : '开始新对话，输入你的问题或想法...'"
            rows="3"
            @keydown.enter.exact.prevent="canSend && (activeConversationId ? sendReply() : createNewConversation())"
          ></textarea>
          <div class="composer__actions">
            <button
              v-if="!activeConversationId"
              class="button button--primary"
              :disabled="!canSend"
              @click="createNewConversation"
            >
              发送
            </button>
            <button
              v-else
              class="button button--primary"
              :disabled="!canSend"
              @click="sendReply"
            >
              回复
            </button>
          </div>
        </div>

        <p v-if="error" class="composer__error">{{ error }}</p>
      </div>

      <!-- 对话历史 -->
      <div v-if="activeConversationId" class="conversation-create__history">
        <div v-if="isLoading" class="history-loading">加载中...</div>
        <div v-else-if="conversationHistory.length === 0" class="history-empty">
          还没有消息，开始对话吧！
        </div>
        <div v-else class="messages">
          <div
            v-for="entry in conversationHistory"
            :key="entry.id"
            class="message"
            :class="{ 'message--user': entry.role === 'user', 'message--assistant': entry.role === 'assistant' }"
          >
            <div class="message__bubble">
              <p class="message__text">{{ entry.text || "(空消息)" }}</p>
              <span class="message__time">{{ formatTime((entry as any).createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 对话列表 -->
    <aside class="conversation-create__sidebar">
      <div class="sidebar-header">
        <h3>对话历史</h3>
        <button class="button button--ghost" @click="loadConversations">刷新</button>
      </div>
      <div class="conversation-list">
        <button
          v-for="conv in conversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ 'conversation-item--active': conv.id === activeConversationId }"
          @click="selectConversation(conv.id)"
        >
          <span class="conversation-item__title">{{ conv.title || "未命名对话" }}</span>
          <span class="conversation-item__time">{{ formatTime(conv.updatedAt) }}</span>
        </button>
        <p v-if="conversations.length === 0" class="empty-state">
          还没有对话
        </p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.conversation-create {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  height: 100%;
}

.conversation-create__main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

.composer {
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  padding: 20px;
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.composer__input-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.composer__input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  font: inherit;
  font-size: 0.95rem;
  resize: vertical;
  min-height: 60px;
  transition: border-color 0.2s;
}

.composer__input:focus {
  outline: none;
  border-color: var(--accent);
}

.composer__actions {
  display: flex;
  justify-content: flex-end;
}

.composer__error {
  margin: 8px 0 0;
  color: #c9633d;
  font-size: 0.85rem;
}

.conversation-create__history {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-loading,
.history-empty {
  text-align: center;
  padding: 40px;
  color: var(--text-soft);
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: flex;
  animation: messageIn 0.3s ease;
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message--user {
  justify-content: flex-end;
}

.message--assistant {
  justify-content: flex-start;
}

.message__bubble {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 16px;
  position: relative;
}

.message--user .message__bubble {
  background: linear-gradient(135deg, #c9633d, #9f4424);
  color: white;
  border-bottom-right-radius: 4px;
}

.message--assistant .message__bubble {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-bottom-left-radius: 4px;
}

.message__text {
  margin: 0;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message__time {
  display: block;
  margin-top: 6px;
  font-size: 0.7rem;
  opacity: 0.7;
  text-align: right;
}

.conversation-create__sidebar {
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  padding: 16px;
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 120px);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 1rem;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
}

.conversation-item {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(95, 64, 28, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversation-item:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateX(2px);
}

.conversation-item--active {
  background: rgba(201, 99, 61, 0.1);
  border-color: rgba(201, 99, 61, 0.3);
}

.conversation-item__title {
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-item__time {
  font-size: 0.7rem;
  color: var(--text-soft);
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--text-soft);
  font-size: 0.85rem;
}

@media (max-width: 820px) {
  .conversation-create {
    grid-template-columns: 1fr;
  }

  .conversation-create__sidebar {
    max-height: 300px;
  }
}
</style>
