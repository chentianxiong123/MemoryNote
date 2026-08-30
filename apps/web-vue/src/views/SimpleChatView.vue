<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

// 会话列表
interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const sessions = ref<Session[]>([]);
const activeSessionId = ref<string | null>(null);
const message = ref("");
const isSending = ref(false);
const error = ref("");

async function loadSessions() {
  try {
    const res = await fetch("/api/v1/conversations?limit=20", {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    sessions.value = data.conversations.map((c: any) => ({
      id: c.id,
      title: c.title || "未命名对话",
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messages: [],
    }));
    if (sessions.value.length > 0 && !activeSessionId.value) {
      activeSessionId.value = sessions.value[0].id;
    }
    if (activeSessionId.value) {
      await loadSessionDetail(activeSessionId.value);
    }
  } catch (err) {
    console.error("加载会话失败:", err);
  }
}

async function loadSessionDetail(sessionId: string) {
  try {
    const res = await fetch(`/api/v1/conversation/${sessionId}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    const messages: Message[] = (data.ConversationHistory ?? []).map((h: any) => ({
      id: h.id,
      role: h.role === "assistant" ? "assistant" : "user",
      content:
        h.parts?.find((p: any) => p.type === "text")?.text || h.message || "",
      createdAt: h.createdAt,
    }));
    const session = sessions.value.find((s) => s.id === sessionId);
    if (session) session.messages = messages;
  } catch (err) {
    console.error("加载会话详情失败:", err);
  }
}

function selectSession(sessionId: string) {
  activeSessionId.value = sessionId;
  const session = sessions.value.find((s) => s.id === sessionId);
  if (session && session.messages.length === 0) {
    void loadSessionDetail(sessionId);
  }
}

async function createSession(title?: string) {
  try {
    const res = await fetch("/api/v1/chat/session/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const session = await res.json();
    sessions.value.unshift(session);
    activeSessionId.value = session.id;
    return session;
  } catch (err) {
    console.error("创建会话失败:", err);
    throw err;
  }
}

async function sendReply(sessionId: string, text: string) {
  try {
    const res = await fetch("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: sessionId, message: text }),
    });
    const reply = await res.json();
    return reply;
  } catch (err) {
    console.error("发送消息失败:", err);
    throw err;
  }
}

async function sendMessage() {
  const text = message.value.trim();
  if (!text || isSending.value) return;

  let sessionId = activeSessionId.value;

  // 如果没有活跃会话，先创建
  if (!sessionId) {
    try {
      const session = await createSession(text.slice(0, 50));
      sessionId = session.id;
    } catch (err) {
      error.value = "创建会话失败";
      return;
    }
  }

  isSending.value = true;
  error.value = "";
  message.value = "";

  // 确保 sessionId 不为 null
  if (!sessionId) {
    error.value = "请先选择或创建对话";
    isSending.value = false;
    return;
  }

  try {
    const reply = await sendReply(sessionId, text);
    await loadSessionDetail(sessionId);
    await loadSessions();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "发送失败";
  } finally {
    isSending.value = false;
  }
}

function formatTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

const canSend = computed(() => message.value.trim() && !isSending.value);

onMounted(() => {
  void loadSessions();
});
</script>

<template>
  <div class="simple-chat">
    <!-- 消息区域 -->
    <main class="chat-main">
      <div class="chat-header">
        <h2>💬 简单聊天</h2>
        <p class="chat-subtitle">纯文本对话，无需 AI 配置</p>
      </div>

      <div class="chat-messages">
        <div v-if="sessions.length === 0" class="empty-chat">
          <p>还没有对话</p>
          <button class="button button--primary" @click="createSession()">开始新对话</button>
        </div>
        <div v-else-if="!activeSessionId" class="empty-chat">
          <p>选择一个会话开始对话</p>
        </div>
        <div v-else class="messages-container">
          <div
            v-for="msg in (sessions.find(s => s.id === activeSessionId)?.messages || [])"
            :key="msg.id"
            class="message"
            :class="`message--${msg.role}`"
          >
            <div class="message__bubble">
              <p class="message__text">{{ msg.content }}</p>
              <span class="message__time">{{ formatTime(msg.createdAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input">
        <textarea
          v-model="message"
          class="chat-input__textarea"
          placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
          rows="3"
          @keydown.enter.exact.prevent="canSend && sendMessage()"
        ></textarea>
        <button
          class="button button--primary"
          :disabled="!canSend"
          @click="sendMessage"
        >
          发送
        </button>
      </div>
    </main>

    <!-- 会话列表 -->
    <aside class="chat-sidebar">
      <div class="sidebar-header">
        <h3>会话列表</h3>
        <button class="button button--ghost" @click="createSession()">+ 新建</button>
      </div>
      <div class="session-list">
        <button
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ 'session-item--active': session.id === activeSessionId }"
          @click="selectSession(session.id)"
        >
          <span class="session-item__title">{{ session.title || "未命名" }}</span>
          <span class="session-item__time">{{ formatTime(session.updatedAt) }}</span>
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.simple-chat {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  height: 100%;
  min-height: 0;
}

.chat-main {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: rgba(255, 250, 244, 0.84);
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.chat-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(95, 64, 28, 0.08);
}

.chat-header h2 {
  margin: 0 0 4px;
  font-size: 1.4rem;
}

.chat-subtitle {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.85rem;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 300px;
  color: var(--text-soft);
}

.messages-container {
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
  max-width: 75%;
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

.chat-input {
  padding: 16px 20px;
  border-top: 1px solid rgba(95, 64, 28, 0.08);
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.chat-input__textarea {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  font: inherit;
  font-size: 0.95rem;
  resize: none;
  min-height: 60px;
  max-height: 150px;
  transition: border-color 0.2s;
}

.chat-input__textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.chat-sidebar {
  background: rgba(255, 250, 244, 0.84);
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  padding: 16px;
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.session-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;
}

.session-item {
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

.session-item:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateX(2px);
}

.session-item--active {
  background: rgba(201, 99, 61, 0.1);
  border-color: rgba(201, 99, 61, 0.3);
}

.session-item__title {
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item__time {
  font-size: 0.7rem;
  color: var(--text-soft);
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.9);
  color: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(89, 50, 19, 0.12);
}

.button--primary {
  background: linear-gradient(135deg, #c9633d, #9f4424);
  color: white;
  border: none;
}

.button--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button--ghost {
  background: transparent;
}

@media (max-width: 820px) {
  .simple-chat {
    grid-template-columns: 1fr;
  }

  .chat-sidebar {
    max-height: 300px;
  }
}
</style>
