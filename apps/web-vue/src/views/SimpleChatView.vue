<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
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

// Pagination
const page = ref(1);
const pageSize = 50;
const total = ref(0);
const totalPages = ref(0);
const isLoadingList = ref(false);

// Rename dialog
const renameDialogOpen = ref(false);
const renamingSession = ref<Session | null>(null);
const renameInput = ref("");

// Delete confirmation
const deleteConfirmOpen = ref(false);
const deletingSession = ref<Session | null>(null);

// Hover tracking
const hoveredSessionId = ref<string | null>(null);

// Search
const searchQuery = ref("");

async function loadSessions(forceLoadFull = false) {
  isLoadingList.value = true;
  try {
    const params = new URLSearchParams({
      limit: String(forceLoadFull ? total.value : pageSize),
      page: String(page.value),
      ...(searchQuery.value ? { search: searchQuery.value } : {}),
    });
    const res = await fetch(`/api/v1/conversations?${params}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    const convs = data.conversations ?? [];
    total.value = data.pagination?.total ?? 0;
    totalPages.value = data.pagination?.totalPages ?? 1;

    // Enrich with message counts
    const enriched: Session[] = convs.map((c: any) => ({
      id: c.id,
      title: c.title || "未命名对话",
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._msgCount ?? 1,
      lastMessage: c.ConversationHistory?.[0]?.message ?? "",
    }));

    if (page.value === 1) {
      sessions.value = enriched;
    } else {
      sessions.value = [...sessions.value, ...enriched];
    }

    if (!activeSessionId.value && sessions.value.length > 0) {
      activeSessionId.value = sessions.value[0].id;
    }
  } catch (err) {
    console.error("加载会话失败:", err);
  } finally {
    isLoadingList.value = false;
  }
}

// Override loadSessionDetail to fetch ALL messages
async function loadSessionDetail(sessionId: string) {
  try {
    const res = await fetch(`/api/v1/conversation/${sessionId}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    const messages: Message[] = (data.ConversationHistory ?? []).map((h: any) => ({
      id: h.id,
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.parts?.find((p: any) => p.type === "text")?.text || h.message || "",
      createdAt: h.createdAt,
    }));
    const session = sessions.value.find((s) => s.id === sessionId);
    if (session) {
      session.messageCount = messages.length;
      session.lastMessage = messages[messages.length - 1]?.content?.slice(0, 50);
    }
    return messages;
  } catch (err) {
    console.error("加载会话详情失败:", err);
    return [];
  }
}

function selectSession(sessionId: string) {
  activeSessionId.value = sessionId;
  const session = sessions.value.find((s) => s.id === sessionId);
  if (session && session.messageCount <= 1) {
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
    sessions.value.unshift({
      id: session.id,
      title: session.title || "未命名对话",
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: 0,
    });
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
    return await res.json();
  } catch (err) {
    console.error("发送消息失败:", err);
    throw err;
  }
}

async function sendMessage() {
  const text = message.value.trim();
  if (!text || isSending.value) return;

  let sessionId = activeSessionId.value;
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

  if (!sessionId) {
    error.value = "请先选择或创建对话";
    isSending.value = false;
    return;
  }

  try {
    await sendReply(sessionId, text);
    await loadSessionDetail(sessionId);
    await loadSessions();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "发送失败";
  } finally {
    isSending.value = false;
  }
}

function openRename(session: Session) {
  renamingSession.value = session;
  renameInput.value = session.title;
  renameDialogOpen.value = true;
}

async function confirmRename() {
  if (!renamingSession.value || !renameInput.value.trim()) return;
  try {
    await fetch(`/api/v1/conversation/${renamingSession.value.id}/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameInput.value.trim() }),
    });
    const session = sessions.value.find((s) => s.id === renamingSession.value!.id);
    if (session) session.title = renameInput.value.trim();
    renameDialogOpen.value = false;
    renamingSession.value = null;
  } catch (err) {
    console.error("重命名失败:", err);
  }
}

function openDeleteConfirm(session: Session) {
  deletingSession.value = session;
  deleteConfirmOpen.value = true;
}

async function confirmDelete() {
  if (!deletingSession.value) return;
  const sessionId = deletingSession.value.id;
  try {
    await fetch(`/api/v1/conversation/${sessionId}/delete`, {
      method: "DELETE",
    });
    sessions.value = sessions.value.filter((s) => s.id !== sessionId);
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = sessions.value[0]?.id ?? null;
      if (activeSessionId.value) {
        await loadSessionDetail(activeSessionId.value);
      }
    }
    deleteConfirmOpen.value = false;
    deletingSession.value = null;
  } catch (err) {
    console.error("删除失败:", err);
  }
}

function formatDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function formatFullDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const canSend = computed(() => message.value.trim() && !isSending.value);

const activeSession = computed(() =>
  sessions.value.find((s) => s.id === activeSessionId.value) ?? null
);

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    void loadSessions();
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--;
    void loadSessions(true);
  }
}

watch(searchQuery, () => {
  page.value = 1;
  void loadSessions(true);
});

onMounted(() => {
  void loadSessions();
});
</script>

<template>
  <div class="chat-layout">
    <!-- 主区域：消息 + 输入 -->
    <main class="chat-main">
      <div class="chat-header">
        <h2>{{ activeSession ? activeSession.title : '选择对话' }}</h2>
        <span v-if="activeSession" class="chat-meta">
          {{ activeSession.messageCount }} 条消息 · {{ formatFullDate(activeSession.updatedAt) }}
        </span>
      </div>

      <div class="chat-messages">
        <div v-if="sessions.length === 0 && !isLoadingList" class="empty-chat">
          <p>还没有对话</p>
          <button class="button button--primary" @click="createSession()">开始新对话</button>
        </div>
        <div v-else-if="!activeSessionId" class="empty-chat">
          <p>从左侧选择一个对话</p>
        </div>
        <div v-else class="messages-container">
          <div
            v-for="msg in (activeSession?.messages || [])"
            :key="msg.id"
            class="message"
            :class="`message--${msg.role}`"
          >
            <div class="message__bubble">
              <p class="message__text">{{ msg.content }}</p>
              <span class="message__time">{{ formatDateTime(msg.createdAt) }}</span>
            </div>
          </div>
          <div v-if="(!activeSession?.messages || activeSession.messages.length === 0)" class="empty-msgs">
            <p>该对话暂无消息内容</p>
          </div>
        </div>
      </div>

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

    <!-- 侧边栏：会话列表 -->
    <aside class="chat-sidebar">
      <div class="sidebar-header">
        <h3>对话列表 ({{ total }})</h3>
        <button class="button button--ghost" @click="createSession()">+ 新建</button>
      </div>

      <input
        v-model="searchQuery"
        class="sidebar-search"
        placeholder="搜索标题..."
      />

      <div class="session-list">
        <div v-if="isLoadingList" class="loading-state">
          <span>加载中...</span>
        </div>
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item-wrapper"
          @mouseenter="hoveredSessionId = session.id"
          @mouseleave="hoveredSessionId = null"
        >
          <button
            class="session-item"
            :class="{ 'session-item--active': session.id === activeSessionId }"
            @click="selectSession(session.id)"
          >
            <span class="session-item__title">{{ session.title }}</span>
            <div class="session-item__footer">
              <span class="session-item__time">{{ formatDateTime(session.updatedAt) }}</span>
              <span class="session-item__count">{{ session.messageCount }}条</span>
            </div>
          </button>
          <div v-if="hoveredSessionId === session.id" class="session-actions">
            <button class="action-btn action-btn--edit" title="重命名" @click.stop="openRename(session)">✏️</button>
            <button class="action-btn action-btn--delete" title="删除" @click.stop="openDeleteConfirm(session)">🗑️</button>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="page-btn" :disabled="page === 1" @click="prevPage">上一页</button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="page === totalPages" @click="nextPage">下一页</button>
      </div>
    </aside>

    <!-- 重命名弹窗 -->
    <div v-if="renameDialogOpen" class="modal-overlay" @click.self="renameDialogOpen = false">
      <div class="modal">
        <h3>重命名对话</h3>
        <input
          v-model="renameInput"
          class="modal-input"
          placeholder="输入新标题..."
          maxlength="200"
          @keydown.enter="confirmRename"
        />
        <div class="modal-actions">
          <button class="button button--ghost" @click="renameDialogOpen = false">取消</button>
          <button class="button button--primary" @click="confirmRename">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteConfirmOpen" class="modal-overlay" @click.self="deleteConfirmOpen = false">
      <div class="modal modal--danger">
        <h3>确认删除</h3>
        <p>确定要删除对话「{{ deletingSession?.title }}」吗？此操作不可恢复。</p>
        <div class="modal-actions">
          <button class="button button--ghost" @click="deleteConfirmOpen = false">取消</button>
          <button class="button button--danger" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  height: calc(100vh - 80px);
  min-height: 500px;
  gap: 12px;
}

/* 主区域 */
.chat-main {
  display: flex;
  flex-direction: column;
  background: rgba(255, 250, 244, 0.84);
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(95, 64, 28, 0.08);
  flex-shrink: 0;
}

.chat-header h2 {
  margin: 0 0 4px;
  font-size: 1.1rem;
  font-weight: 600;
}

.chat-meta {
  font-size: 0.78rem;
  color: var(--text-soft);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  min-height: 0;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 100%;
  color: var(--text-soft);
}

.empty-msgs {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-soft);
  font-size: 0.9rem;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  animation: messageIn 0.2s ease;
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.message--user { justify-content: flex-end; }
.message--assistant { justify-content: flex-start; }

.message__bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 14px;
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
  font-size: 0.92rem;
}

.message__time {
  display: block;
  margin-top: 4px;
  font-size: 0.68rem;
  opacity: 0.55;
  text-align: right;
}

.chat-input {
  padding: 12px 16px;
  border-top: 1px solid rgba(95, 64, 28, 0.08);
  display: flex;
  gap: 10px;
  align-items: flex-end;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.5);
}

.chat-input__textarea {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  font: inherit;
  font-size: 0.9rem;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  transition: border-color 0.2s;
  line-height: 1.5;
}

.chat-input__textarea:focus {
  outline: none;
  border-color: var(--accent);
}

/* 侧边栏 */
.chat-sidebar {
  background: rgba(255, 250, 244, 0.84);
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  padding: 14px;
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 0.95rem;
}

.sidebar-search {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  font: inherit;
  font-size: 0.85rem;
  flex-shrink: 0;
  box-sizing: border-box;
}

.sidebar-search:focus {
  outline: none;
  border-color: var(--accent);
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.loading-state {
  text-align: center;
  padding: 20px;
  color: var(--text-soft);
  font-size: 0.85rem;
}

.session-item-wrapper {
  position: relative;
}

.session-item {
  width: 100%;
  padding: 8px 10px;
  padding-right: 36px;
  border: 1px solid rgba(95, 64, 28, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-item__time {
  font-size: 0.68rem;
  color: var(--text-soft);
}

.session-item__count {
  font-size: 0.65rem;
  color: var(--text-soft);
  background: rgba(201, 99, 61, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
}

.session-actions {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.session-item-wrapper:hover .session-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0;
  transition: background 0.15s;
}

.action-btn--edit:hover { background: rgba(201, 99, 61, 0.15); }
.action-btn--delete:hover { background: rgba(220, 50, 50, 0.15); }

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(95, 64, 28, 0.08);
  flex-shrink: 0;
}

.page-btn {
  padding: 4px 12px;
  border: 1px solid rgba(95, 64, 28, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.6);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: rgba(201, 99, 61, 0.1);
  border-color: rgba(201, 99, 61, 0.3);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.75rem;
  color: var(--text-soft);
}

/* 通用按钮 */
.button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.9);
  color: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(89, 50, 19, 0.1);
}

.button--primary {
  background: linear-gradient(135deg, #c9633d, #9f4424);
  color: white;
  border: none;
}

.button--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.button--ghost {
  background: transparent;
  padding: 6px 10px;
  font-size: 0.8rem;
}

.button--danger {
  background: rgba(220, 50, 50, 0.9);
  color: white;
  border: none;
}

.button--danger:hover { background: rgba(200, 40, 40, 1); }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: rgba(255, 250, 244, 0.98);
  border: 1px solid rgba(95, 64, 28, 0.15);
  border-radius: 16px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.15);
}

.modal h3 { margin: 0 0 12px; font-size: 1.1rem; }
.modal p { margin: 0 0 16px; font-size: 0.9rem; color: var(--text-soft); line-height: 1.5; }

.modal-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(95, 64, 28, 0.2);
  border-radius: 8px;
  font: inherit;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.8);
  margin-bottom: 16px;
  box-sizing: border-box;
}

.modal-input:focus { outline: none; border-color: var(--accent); }

.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 820px) {
  .chat-layout {
    grid-template-columns: 1fr;
    height: auto;
    min-height: auto;
  }
  .chat-main { min-height: 500px; }
  .chat-sidebar { max-height: 400px; }
}
</style>
