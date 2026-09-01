<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import SectionCard from "@/components/SectionCard.vue";
import {
  fetchTagCloud,
  fetchBlockedKeywords,
  blockKeyword,
  unblockKeyword,
} from "@/lib/api";

const router = useRouter();

// 自动提取的关键词标签
const keywords = ref<Array<{ word: string; doc_count: number; total_weight: number }>>([]);
const loadingKeywords = ref(false);
const blockedWords = ref<Set<string>>(new Set());
const search = ref("");

// 默认屏蔽的纯数字关键词
const DEFAULT_BLOCKED_PATTERNS = [/^\d+$/, /^-?\d+\.?\d*$/];

function isDefaultValue(word: string): boolean {
  return DEFAULT_BLOCKED_PATTERNS.some((pattern) => pattern.test(word.trim()));
}

const filteredKeywords = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return keywords.value;
  return keywords.value.filter((kw) =>
    kw.word.toLowerCase().includes(keyword)
  );
});

const blockedCount = computed(() => blockedWords.value.size);

async function loadKeywords() {
  loadingKeywords.value = true;
  try {
    const res = await fetchTagCloud(1, 200);
    keywords.value = res.tags.map((t: any) => ({
      word: t.word,
      doc_count: t.doc_count,
      total_weight: t.total_weight,
    }));
  } catch (err) {
    console.error("Failed to load keywords", err);
  } finally {
    loadingKeywords.value = false;
  }
}

async function loadBlocked() {
  try {
    const res = await fetchBlockedKeywords();
    blockedWords.value = new Set(res.map((k) => k.word.toLowerCase()));
  } catch (err) {
    console.error("Failed to load blocked keywords", err);
  }
}

async function toggleBlock(word: string) {
  const lower = word.toLowerCase();
  if (blockedWords.value.has(lower)) {
    await unblockKeyword(word);
    blockedWords.value.delete(lower);
  } else {
    await blockKeyword(word);
    blockedWords.value.add(lower);
  }
}

function viewKeywordDocs(word: string) {
  router.push({ path: "/home/memory/documents", query: { q: word } });
}

onMounted(async () => {
  await Promise.all([loadKeywords(), loadBlocked()]);
});
</script>

<template>
  <SectionCard title="关键词标签" eyebrow="自动提取">
    <p v-if="loadingKeywords" class="status">加载中...</p>
    <p v-else-if="keywords.length === 0" class="status status--error">暂无关键词</p>

    <div class="toolbar">
      <input
        v-model="search"
        class="input"
        placeholder="搜索关键词..."
        style="flex: 1"
      />
      <div class="meta-card meta-card--compact">
        <span class="meta-card__label">关键词总数</span>
        <strong>{{ filteredKeywords.length }}</strong>
      </div>
      <div class="meta-card meta-card--compact" :class="{ 'meta-card--warning': blockedCount > 0 }">
        <span class="meta-card__label">已屏蔽</span>
        <strong>{{ blockedCount }}</strong>
      </div>
    </div>

    <div class="keyword-list">
      <article
        v-for="kw in filteredKeywords"
        :key="kw.word"
        class="keyword-item"
        :class="{ 'keyword-item--default-blocked': isDefaultValue(kw.word) && !blockedWords.has(kw.word.toLowerCase()) }"
      >
        <span class="keyword-word">{{ kw.word }}</span>
        <span class="keyword-count">{{ kw.doc_count }} 篇</span>
        <div class="keyword-actions">
          <button
            class="btn btn--ghost btn--sm"
            @click="viewKeywordDocs(kw.word)"
          >
            查看
          </button>
          <button
            class="btn btn--sm"
            :class="
              blockedWords.has(kw.word.toLowerCase())
                ? 'btn--danger'
                : isDefaultValue(kw.word)
                  ? 'btn--default-blocked'
                  : 'btn--secondary'
            "
            @click="toggleBlock(kw.word)"
          >
            {{ blockedWords.has(kw.word.toLowerCase()) ? "已屏蔽" : isDefaultValue(kw.word) ? "默认屏蔽" : "屏蔽" }}
          </button>
        </div>
      </article>
    </div>

    <div v-if="filteredKeywords.length === 0" class="empty-state">
      <p>没有匹配的关键词。</p>
    </div>
  </SectionCard>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.keyword-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.keyword-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.keyword-item--default-blocked {
  background: rgba(100, 116, 139, 0.05);
  border-color: rgba(100, 116, 139, 0.15);
}

.keyword-word {
  font-weight: 500;
  color: #1e293b;
  min-width: 120px;
}

.keyword-count {
  font-size: 13px;
  color: #64748b;
  min-width: 60px;
}

.keyword-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.btn--ghost.btn--sm {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}

.btn--ghost.btn--sm:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.btn--sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s;
}

.btn--secondary {
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
  background: transparent;
}

.btn--secondary:hover {
  background: rgba(239, 68, 68, 0.1);
}

.btn--danger {
  border-color: rgba(34, 197, 94, 0.3);
  color: #16a34a;
  background: transparent;
}

.btn--danger:hover {
  background: rgba(34, 197, 94, 0.1);
}

.btn--default-blocked {
  border-color: rgba(100, 116, 139, 0.3);
  color: #64748b;
  background: transparent;
  cursor: not-allowed;
}

.meta-card--warning {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.2);
}
</style>
