<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import RejectReasonModal from "@/components/RejectReasonModal.vue";
import {
  fetchWikiEntries,
  publishWikiEntry,
  rejectWikiEntry,
  type RejectReason,
  type WikiEntryResponse,
  type WikiEntryStatus,
} from "@/lib/api";

const entries = ref<WikiEntryResponse[]>([]);
const isLoading = ref(false);
const error = ref("");
const searchQuery = ref("");
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);
const limit = 12;
const activeStatus = ref<WikiEntryStatus>("PUBLISHED");
const statusCounts = ref<{ DRAFT: number; PUBLISHED: number; REJECTED: number }>({
  DRAFT: 0,
  PUBLISHED: 0,
  REJECTED: 0,
});
const pendingActionId = ref<string | null>(null);
const rejectingEntryId = ref<string | null>(null);

function formatDateTime(value?: string | null) {
  if (!value) return "未记录";
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadEntries() {
  isLoading.value = true;
  error.value = "";

  try {
    const response = await fetchWikiEntries({
      page: currentPage.value,
      limit,
      search: searchQuery.value || undefined,
      status: activeStatus.value,
    });
    entries.value = response.entries;
    totalPages.value = response.pagination.totalPages;
    totalCount.value = response.pagination.total;
    if (response.statusCounts) statusCounts.value = response.statusCounts;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载词条列表失败。";
    entries.value = [];
  } finally {
    isLoading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  void loadEntries();
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  void loadEntries();
}

function selectStatus(status: WikiEntryStatus) {
  if (activeStatus.value === status) return;
  activeStatus.value = status;
  currentPage.value = 1;
  void loadEntries();
}

async function handlePublish(entryId: string) {
  pendingActionId.value = entryId;
  try {
    await publishWikiEntry(entryId);
    await loadEntries();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "发布词条失败。";
  } finally {
    pendingActionId.value = null;
  }
}

async function handleReject(entryId: string) {
  rejectingEntryId.value = entryId;
}

async function confirmReject(payload: { reason: RejectReason; notes: string }) {
  if (!rejectingEntryId.value) return;
  pendingActionId.value = rejectingEntryId.value;
  const targetId = rejectingEntryId.value;
  try {
    await rejectWikiEntry(targetId, payload);
    rejectingEntryId.value = null;
    await loadEntries();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "拒绝词条失败。";
  } finally {
    pendingActionId.value = null;
  }
}

function cancelReject() {
  rejectingEntryId.value = null;
}

watch(searchQuery, () => {
  if (searchQuery.value === "") {
    currentPage.value = 1;
    void loadEntries();
  }
});

onMounted(() => {
  void loadEntries();
});
</script>

<template>
  <div class="wiki-list">
    <header class="wiki-list__header">
      <div class="wiki-list__title">
        <p class="wiki-list__eyebrow">Wiki</p>
        <h1>词条库</h1>
        <p class="wiki-list__intro">浏览和搜索知识图谱中的所有词条</p>
      </div>
    </header>

    <div class="wiki-list__toolbar">
      <div class="search-box">
        <input
          v-model="searchQuery"
          class="input search-box__input"
          type="text"
          placeholder="搜索词条..."
          @keyup.enter="handleSearch"
        />
        <button class="button" :disabled="isLoading" @click="handleSearch">
          {{ isLoading ? "搜索中..." : "搜索" }}
        </button>
      </div>
      <div class="wiki-list__stats">
        <span class="chip">共 {{ totalCount }} 个词条</span>
      </div>
    </div>

    <div class="status-tabs">
      <button
        class="status-tabs__item"
        :class="{ 'status-tabs__item--active': activeStatus === 'PUBLISHED' }"
        @click="selectStatus('PUBLISHED')"
      >
        已发布
        <span class="status-tabs__badge">{{ statusCounts.PUBLISHED }}</span>
      </button>
      <button
        class="status-tabs__item"
        :class="{ 'status-tabs__item--active': activeStatus === 'DRAFT', 'status-tabs__item--draft': statusCounts.DRAFT > 0 }"
        @click="selectStatus('DRAFT')"
      >
        草稿待审
        <span class="status-tabs__badge">{{ statusCounts.DRAFT }}</span>
      </button>
      <button
        class="status-tabs__item"
        :class="{ 'status-tabs__item--active': activeStatus === 'REJECTED' }"
        @click="selectStatus('REJECTED')"
      >
        已拒绝
        <span class="status-tabs__badge">{{ statusCounts.REJECTED }}</span>
      </button>
    </div>

    <p v-if="error" class="wiki-list__error">{{ error }}</p>

    <div v-else-if="entries.length === 0 && !isLoading" class="empty-state">
      {{ activeStatus === "DRAFT" ? "没有等待审核的草稿。" : activeStatus === "REJECTED" ? "没有被拒绝的词条。" : "暂无词条数据" }}
    </div>

    <div v-else class="wiki-list__grid">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="wiki-card"
        :class="{ 'wiki-card--draft': entry.status === 'DRAFT', 'wiki-card--rejected': entry.status === 'REJECTED' }"
      >
        <RouterLink
          class="wiki-card__link"
          :to="`/home/wiki/${encodeURIComponent(entry.entityUuid)}`"
        >
          <div class="wiki-card__head">
            <h3 class="wiki-card__title">{{ entry.title }}</h3>
            <span v-if="entry.status === 'DRAFT'" class="status-pill status-pill--draft">草稿</span>
            <span v-if="entry.status === 'REJECTED'" class="status-pill status-pill--rejected">已拒</span>
          </div>
          <p class="wiki-card__definition">{{ entry.definition || "暂无定义" }}</p>
          <div class="wiki-card__meta">
            <span class="wiki-card__time">{{ formatDateTime(entry.updatedAt) }}</span>
          </div>
        </RouterLink>
        <div v-if="entry.status === 'DRAFT'" class="wiki-card__actions">
          <button
            class="button button--small"
            :disabled="pendingActionId === entry.id"
            @click.stop="handlePublish(entry.id)"
          >
            发布
          </button>
          <button
            class="button button--small button--ghost"
            :disabled="pendingActionId === entry.id"
            @click.stop="handleReject(entry.id)"
          >
            拒绝
          </button>
        </div>
      </div>
    </div>

    <div v-if="totalPages > 1" class="wiki-list__pagination">
      <button
        class="button button--ghost"
        :disabled="currentPage <= 1 || isLoading"
        @click="goToPage(currentPage - 1)"
      >
        上一页
      </button>
      <div class="pagination-info">
        <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
      </div>
      <button
        class="button button--ghost"
        :disabled="currentPage >= totalPages || isLoading"
        @click="goToPage(currentPage + 1)"
      >
        下一页
      </button>
    </div>

    <RejectReasonModal
      :open="rejectingEntryId !== null"
      :pending="pendingActionId !== null"
      title="拒绝词条草稿"
      @cancel="cancelReject"
      @confirm="confirmReject"
    />
  </div>
</template>

<style scoped>
.wiki-list {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  background:
    radial-gradient(circle at top left, rgba(47, 125, 128, 0.12), transparent 20rem),
    linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(244, 237, 228, 0.96));
}

.wiki-list__header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.wiki-list__title h1 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
}

.wiki-list__eyebrow {
  margin: 0 0 6px;
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.wiki-list__intro {
  margin: 8px 0 0;
  color: var(--text-soft);
}

.wiki-list__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  gap: 10px;
  flex: 1;
  max-width: 480px;
}

.search-box__input {
  flex: 1;
}

.wiki-list__stats {
  display: flex;
  gap: 10px;
}

.wiki-list__error {
  color: #a22b2b;
  padding: 16px;
  border-radius: 16px;
  background: rgba(162, 43, 43, 0.08);
  border: 1px solid rgba(162, 43, 43, 0.2);
}

.wiki-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.wiki-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
  text-decoration: none;
  color: inherit;
  transition: 140ms ease;
}

.wiki-card__link {
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}

.wiki-card--draft {
  border-color: rgba(212, 107, 50, 0.32);
  background: rgba(255, 245, 234, 0.94);
}

.wiki-card--rejected {
  opacity: 0.55;
}

.wiki-card__actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px dashed rgba(95, 64, 28, 0.16);
}

.button--small {
  padding: 4px 12px;
  font-size: 0.82rem;
}

.status-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  background: rgba(255, 250, 244, 0.6);
  width: fit-content;
}

.status-tabs__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.88rem;
  color: var(--text-soft);
  transition: 120ms ease;
}

.status-tabs__item:hover {
  background: rgba(95, 64, 28, 0.06);
}

.status-tabs__item--active {
  background: rgba(201, 99, 61, 0.14);
  color: var(--text);
  font-weight: 600;
}

.status-tabs__item--draft:not(.status-tabs__item--active) .status-tabs__badge {
  background: rgba(212, 107, 50, 0.85);
  color: white;
}

.status-tabs__badge {
  font-size: 0.72rem;
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(95, 64, 28, 0.1);
  color: var(--text-soft);
  min-width: 20px;
  text-align: center;
}

.status-pill {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  flex-shrink: 0;
}

.status-pill--draft {
  background: rgba(212, 107, 50, 0.16);
  color: #a8521e;
}

.status-pill--rejected {
  background: rgba(120, 120, 120, 0.16);
  color: #555;
}

.wiki-card:hover {
  border-color: rgba(201, 99, 61, 0.44);
  background: rgba(201, 99, 61, 0.08);
}

.wiki-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.wiki-card__title {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.15rem;
}

.wiki-card__definition {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.92rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.wiki-card__meta {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
}

.wiki-card__time {
  font-size: 0.78rem;
  color: var(--text-soft);
}

.wiki-list__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.pagination-info {
  color: var(--text-soft);
  font-size: 0.9rem;
}

@media (max-width: 780px) {
  .wiki-list {
    padding: 14px;
  }

  .wiki-list__header {
    flex-direction: column;
  }

  .wiki-list__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

  .wiki-list__grid {
    grid-template-columns: 1fr;
  }
}
</style>
