<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";

import RejectReasonModal from "@/components/RejectReasonModal.vue";
import {
  acceptKnowledgeCaptureBatch,
  acceptKnowledgeCaptureItem,
  fetchKnowledgeInbox,
  mergeKnowledgeCaptureItem,
  rejectKnowledgeCaptureBatch,
  rejectKnowledgeCaptureItem,
  searchKnowledgeObjects,
  snoozeKnowledgeCaptureItem,
  type KnowledgeCaptureBatchRecord,
  type KnowledgeCaptureItemRecord,
  type KnowledgeInboxResponse,
  type RejectReason,
} from "@/lib/api";

const inbox = ref<KnowledgeInboxResponse | null>(null);
const error = ref("");
const isLoading = ref(false);
const busyIds = reactive<Record<string, boolean>>({});
const mergeOpen = reactive<Record<string, boolean>>({});
const mergeQuery = reactive<Record<string, string>>({});
const mergeResults = reactive<Record<string, Array<{ id: string; title: string; type: string; kind: string }>>>({});
const rejectingItemId = ref<string | null>(null);
const rejectingBatchId = ref<string | null>(null);

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    entity: "对象",
    relation: "关系",
    event: "事件",
    decision: "决策",
  };
  return labels[kind] || kind;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    proposed: "待确认",
    accepted: "已接受",
    rejected: "已忽略",
    snoozed: "稍后再看",
    merged: "已合并",
  };
  return labels[status] || status;
}

function objectHref(item: KnowledgeCaptureItemRecord) {
  return item.graphObjectId
    ? `/home/memory/graph/object/${encodeURIComponent(item.graphObjectId)}`
    : "/home/memory/graph";
}

function payloadText(item: KnowledgeCaptureItemRecord, key: string) {
  const value = item.payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function payloadAliases(item: KnowledgeCaptureItemRecord) {
  const value = item.payload.aliases;
  return Array.isArray(value)
    ? value.map((alias) => String(alias).trim()).filter(Boolean).slice(0, 8)
    : [];
}

function evidenceSourceLabel(item: KnowledgeCaptureItemRecord) {
  const label = item.evidence?.sourceLabel;
  if (typeof label === "string" && label.trim()) return label;
  const type = item.evidence?.sourceType;
  const labels: Record<string, string> = {
    conversation: "对话",
    note: "笔记",
    document: "文档",
    web: "网页摘录",
  };
  return typeof type === "string" ? labels[type] ?? "对话" : "对话";
}

function evidenceText(item: KnowledgeCaptureItemRecord) {
  const sourceText = payloadText(item, "sourceText");
  if (sourceText) return sourceText;
  const assistantMessage = item.evidence?.assistantMessage;
  if (typeof assistantMessage === "string" && assistantMessage.trim()) return assistantMessage;
  const userMessage = item.evidence?.userMessage;
  if (typeof userMessage === "string" && userMessage.trim()) return userMessage;
  return "";
}

function formatDateTime(value?: string | null) {
  if (!value) return "刚刚";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadInbox() {
  isLoading.value = true;
  error.value = "";

  try {
    inbox.value = await fetchKnowledgeInbox();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载学习收件箱失败。";
    inbox.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function withBusy(id: string, task: () => Promise<void>) {
  busyIds[id] = true;
  try {
    await task();
  } finally {
    busyIds[id] = false;
  }
}

async function acceptItem(item: KnowledgeCaptureItemRecord) {
  await withBusy(item.id, async () => {
    await acceptKnowledgeCaptureItem(item.id);
    await loadInbox();
  });
}

async function rejectItem(item: KnowledgeCaptureItemRecord) {
  rejectingItemId.value = item.id;
}

async function confirmRejectItem(payload: { reason: RejectReason; notes: string }) {
  const id = rejectingItemId.value;
  if (!id) return;
  await withBusy(id, async () => {
    await rejectKnowledgeCaptureItem(id, payload);
    rejectingItemId.value = null;
    await loadInbox();
  });
}

function cancelRejectItem() {
  rejectingItemId.value = null;
}

async function snoozeItem(item: KnowledgeCaptureItemRecord) {
  await withBusy(item.id, async () => {
    await snoozeKnowledgeCaptureItem(item.id);
    await loadInbox();
  });
}

async function acceptBatch(batch: KnowledgeCaptureBatchRecord) {
  await withBusy(batch.id, async () => {
    await acceptKnowledgeCaptureBatch(batch.id);
    await loadInbox();
  });
}

async function rejectBatch(batch: KnowledgeCaptureBatchRecord) {
  rejectingBatchId.value = batch.id;
}

async function confirmRejectBatch(payload: { reason: RejectReason; notes: string }) {
  const id = rejectingBatchId.value;
  if (!id) return;
  await withBusy(id, async () => {
    await rejectKnowledgeCaptureBatch(id, payload);
    rejectingBatchId.value = null;
    await loadInbox();
  });
}

function cancelRejectBatch() {
  rejectingBatchId.value = null;
}

async function searchMergeTargets(item: KnowledgeCaptureItemRecord) {
  const query = (mergeQuery[item.id] ?? "").trim();
  if (!query) {
    mergeResults[item.id] = [];
    return;
  }

  const response = await searchKnowledgeObjects(query);
  mergeResults[item.id] = response.results.filter((result) => result.kind === "entity");
}

async function mergeInto(item: KnowledgeCaptureItemRecord, targetId: string) {
  const targetUuid = targetId.startsWith("entity:") ? targetId.slice("entity:".length) : targetId;
  await withBusy(item.id, async () => {
    await mergeKnowledgeCaptureItem(item.id, targetUuid);
    mergeOpen[item.id] = false;
    mergeQuery[item.id] = "";
    mergeResults[item.id] = [];
    await loadInbox();
  });
}

const batches = computed(() => inbox.value?.batches ?? []);

onMounted(() => {
  void loadInbox();
});
</script>

<template>
  <div class="knowledge-inbox">
    <header class="knowledge-inbox__header">
      <div>
        <p class="knowledge-inbox__eyebrow">Learning Inbox</p>
        <h1>学习收件箱</h1>
        <p class="knowledge-inbox__intro">
          AI 先提议，你再确认哪些对象、关系、事件、决策应该进入长期知识层。
        </p>
      </div>

      <div class="knowledge-inbox__actions">
        <RouterLink class="button button--ghost" to="/home/memory/graph">返回工作台</RouterLink>
        <button class="button" :disabled="isLoading" @click="loadInbox">
          {{ isLoading ? "刷新中..." : "刷新收件箱" }}
        </button>
      </div>
    </header>

    <p v-if="error" class="knowledge-inbox__error">{{ error }}</p>

    <section v-if="inbox" class="knowledge-inbox__stats">
      <article class="stat-card">
        <span>待确认</span>
        <strong>{{ inbox.stats.proposedCount }}</strong>
      </article>
      <article class="stat-card">
        <span>稍后再看</span>
        <strong>{{ inbox.stats.snoozedCount }}</strong>
      </article>
      <article class="stat-card">
        <span>Recap 批次</span>
        <strong>{{ inbox.stats.batchCount }}</strong>
      </article>
    </section>

    <div v-if="batches.length === 0" class="knowledge-inbox__empty">
      还没有新的候选记忆。继续对话后，这里会自动出现 AI 提炼出的 recap 和候选项。
    </div>

    <section v-else class="batch-list">
      <article v-for="batch in batches" :key="batch.id" class="batch-card">
        <header class="batch-card__head">
          <div>
            <p class="batch-card__eyebrow">{{ formatDateTime(batch.createdAt) }}</p>
            <h2>{{ batch.summary }}</h2>
          </div>
          <div class="batch-card__head-actions">
            <button class="button button--ghost" :disabled="busyIds[batch.id]" @click="acceptBatch(batch)">
              {{ busyIds[batch.id] ? "处理中..." : "整组接受" }}
            </button>
            <button class="button button--ghost button--subtle" :disabled="busyIds[batch.id]" @click="rejectBatch(batch)">
              整组拒绝
            </button>
          </div>
        </header>

        <div class="batch-card__counts">
          <span class="chip">待确认 {{ batch.counts.proposed }}</span>
          <span class="chip">已接受 {{ batch.counts.accepted }}</span>
          <span class="chip">稍后 {{ batch.counts.snoozed }}</span>
        </div>

        <div class="item-list">
          <article v-for="item in batch.items ?? []" :key="item.id" class="item-card">
            <div class="item-card__head">
              <div>
                <p class="item-card__eyebrow">
                  {{ kindLabel(item.kind) }} · {{ statusLabel(item.status) }}
                </p>
                <h3>{{ item.title }}</h3>
              </div>
              <span class="item-card__confidence">{{ item.confidence?.toFixed(2) ?? "--" }}</span>
            </div>

            <p v-if="item.kind !== 'entity'" class="item-card__fact">
              {{
                typeof item.payload.fact === "string"
                  ? item.payload.fact
                  : typeof item.payload.name === "string"
                    ? item.payload.name
                    : "候选知识项"
              }}
            </p>

            <div v-if="payloadText(item, 'definitionDraft')" class="item-card__definition">
              <span>解释草稿</span>
              <p>{{ payloadText(item, "definitionDraft") }}</p>
            </div>

            <div v-if="payloadAliases(item).length > 0" class="chip-list item-card__aliases">
              <span v-for="alias in payloadAliases(item)" :key="alias" class="chip">
                {{ alias }}
              </span>
            </div>

            <div v-if="evidenceText(item)" class="item-card__evidence">
              <span>{{ evidenceSourceLabel(item) }}</span>
              <p>{{ evidenceText(item) }}</p>
            </div>

            <div class="item-card__meta">
              <span>首次出现 {{ formatDateTime(item.firstSeenAt) }}</span>
              <span>最近出现 {{ formatDateTime(item.lastSeenAt) }}</span>
            </div>

            <div class="item-card__actions">
              <RouterLink v-if="item.graphObjectId" class="button button--ghost" :to="objectHref(item)">
                查看对象
              </RouterLink>
              <button
                v-if="item.status === 'proposed' || item.status === 'snoozed'"
                class="button"
                :disabled="busyIds[item.id]"
                @click="acceptItem(item)"
              >
                接受
              </button>
              <button
                v-if="item.status === 'proposed'"
                class="button button--ghost"
                :disabled="busyIds[item.id]"
                @click="snoozeItem(item)"
              >
                稍后
              </button>
              <button
                v-if="item.status === 'proposed' || item.status === 'snoozed'"
                class="button button--ghost"
                :disabled="busyIds[item.id]"
                @click="rejectItem(item)"
              >
                忽略
              </button>
              <button
                v-if="item.kind === 'entity' && (item.status === 'proposed' || item.status === 'snoozed')"
                class="button button--ghost"
                @click="mergeOpen[item.id] = !mergeOpen[item.id]"
              >
                合并到已有对象
              </button>
            </div>

            <div v-if="mergeOpen[item.id]" class="merge-box">
              <div class="merge-box__row">
                <input
                  v-model="mergeQuery[item.id]"
                  class="input"
                  placeholder="搜索已有对象"
                  @input="void searchMergeTargets(item)"
                />
              </div>
              <div v-if="(mergeResults[item.id] ?? []).length > 0" class="merge-box__results">
                <button
                  v-for="result in mergeResults[item.id]"
                  :key="result.id"
                  class="merge-box__result"
                  @click="mergeInto(item, result.id)"
                >
                  <strong>{{ result.title }}</strong>
                  <span>{{ result.type }}</span>
                </button>
              </div>
            </div>
          </article>
        </div>
      </article>
    </section>

    <RejectReasonModal
      :open="rejectingItemId !== null"
      :pending="rejectingItemId !== null && busyIds[rejectingItemId]"
      title="拒绝候选条目"
      @cancel="cancelRejectItem"
      @confirm="confirmRejectItem"
    />

    <RejectReasonModal
      :open="rejectingBatchId !== null"
      :pending="rejectingBatchId !== null && busyIds[rejectingBatchId]"
      title="整组拒绝候选"
      @cancel="cancelRejectBatch"
      @confirm="confirmRejectBatch"
    />
  </div>
</template>

<style scoped>
.knowledge-inbox {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  background:
    radial-gradient(circle at top left, rgba(201, 99, 61, 0.12), transparent 24rem),
    linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(244, 237, 228, 0.96));
}

.knowledge-inbox__header,
.stat-card,
.batch-card,
.item-card {
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.knowledge-inbox__header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
}

.knowledge-inbox__header h1,
.batch-card__head h2,
.item-card__head h3 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
}

.knowledge-inbox__eyebrow,
.batch-card__eyebrow,
.item-card__eyebrow {
  margin: 0 0 6px;
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.knowledge-inbox__actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.knowledge-inbox__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  padding: 16px;
}

.stat-card span {
  display: block;
  color: var(--text-soft);
}

.stat-card strong {
  display: block;
  margin-top: 8px;
  font-size: 1.8rem;
}

.knowledge-inbox__empty,
.knowledge-inbox__error {
  color: var(--text-soft);
}

.batch-list,
.item-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.batch-card,
.item-card {
  padding: 16px;
}

.batch-card__head,
.item-card__head,
.item-card__actions,
.item-card__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.batch-card__head,
.item-card__head {
  align-items: flex-start;
}

.batch-card__head-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.batch-card__counts,
.item-card__actions,
.item-card__meta {
  margin-top: 12px;
  flex-wrap: wrap;
}

.item-card__confidence {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(201, 99, 61, 0.1);
  color: var(--accent-strong);
}

.item-card__fact,
.item-card__definition,
.item-card__evidence {
  margin: 12px 0 0;
  color: var(--text-soft);
}

.item-card__definition {
  padding: 12px;
  border-radius: 14px;
  background: rgba(47, 125, 128, 0.08);
  border: 1px solid rgba(47, 125, 128, 0.14);
}

.item-card__definition span,
.item-card__evidence span {
  display: block;
  margin-bottom: 6px;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 700;
}

.item-card__definition p,
.item-card__evidence p {
  margin: 0;
}

.item-card__evidence {
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(95, 64, 28, 0.08);
}

.item-card__aliases {
  margin-top: 10px;
}

.merge-box {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.merge-box__results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.merge-box__result {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  background: rgba(255, 255, 255, 0.8);
  text-align: left;
  cursor: pointer;
}

@media (max-width: 980px) {
  .knowledge-inbox {
    padding: 14px;
  }

  .knowledge-inbox__header {
    flex-direction: column;
  }

  .knowledge-inbox__stats {
    grid-template-columns: 1fr;
  }
}
</style>
