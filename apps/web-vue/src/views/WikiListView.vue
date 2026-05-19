<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import {
  fetchWikiEntries,
  type WikiEntryResponse,
} from "@/lib/api";

const entries = ref<WikiEntryResponse[]>([]);
const isLoading = ref(false);
const error = ref("");
const searchQuery = ref("");
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);
const limit = 12;

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
    });
    entries.value = response.entries;
    totalPages.value = response.pagination.totalPages;
    totalCount.value = response.pagination.total;
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

    <p v-if="error" class="wiki-list__error">{{ error }}</p>

    <div v-else-if="entries.length === 0 && !isLoading" class="empty-state">
      暂无词条数据
    </div>

    <div v-else class="wiki-list__grid">
      <RouterLink
        v-for="entry in entries"
        :key="entry.id"
        class="wiki-card"
        :to="`/home/wiki/${encodeURIComponent(entry.entityUuid)}`"
      >
        <div class="wiki-card__head">
          <h3 class="wiki-card__title">{{ entry.title }}</h3>
        </div>
        <p class="wiki-card__definition">{{ entry.definition || "暂无定义" }}</p>
        <div class="wiki-card__meta">
          <span class="wiki-card__time">{{ formatDateTime(entry.updatedAt) }}</span>
        </div>
      </RouterLink>
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
