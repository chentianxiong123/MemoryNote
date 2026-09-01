<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import SectionCard from "@/components/SectionCard.vue";
import {
  fetchLabels,
  createLabel,
  deleteLabel,
  fetchTagCloud,
  fetchBlockedKeywords,
  blockKeyword,
  unblockKeyword,
  type LabelRecord,
} from "@/lib/api";

const router = useRouter();

// 用户创建的标签
const labels = ref<LabelRecord[]>([]);
const error = ref("");
const search = ref("");
const showCreate = ref(false);
const newName = ref("");
const newDescription = ref("");
const newColor = ref("#3b82f6");
const creating = ref(false);

// 自动提取的关键词标签
const keywords = ref<Array<{ word: string; doc_count: number; total_weight: number }>>([]);
const loadingKeywords = ref(false);
const blockedWords = ref<Set<string>>(new Set());

const filteredLabels = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return labels.value;
  return labels.value.filter((label) => {
    return (
      label.name.toLowerCase().includes(keyword) ||
      (label.description ?? "").toLowerCase().includes(keyword)
    );
  });
});

const filteredKeywords = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return keywords.value;
  return keywords.value.filter((kw) =>
    kw.word.toLowerCase().includes(keyword)
  );
});

function viewLabelDocs(label: LabelRecord) {
  router.push({ path: "/home/memory/documents", query: { q: label.name } });
}

function viewKeywordDocs(word: string) {
  router.push({ path: "/home/memory/documents", query: { q: word } });
}

async function loadLabels() {
  try {
    labels.value = await fetchLabels();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载标签失败。";
  }
}

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

async function handleCreate() {
  const name = newName.value.trim();
  if (!name) {
    error.value = "标签名不能为空";
    return;
  }
  creating.value = true;
  error.value = "";
  try {
    await createLabel({
      name,
      description: newDescription.value.trim() || undefined,
      color: newColor.value,
    });
    newName.value = "";
    newDescription.value = "";
    newColor.value = "#3b82f6";
    showCreate.value = false;
    await loadLabels();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "创建失败。";
  } finally {
    creating.value = false;
  }
}

async function handleDelete(label: LabelRecord) {
  if (!confirm(`确定删除标签「${label.name}」吗？`)) return;
  try {
    await deleteLabel(label.id);
    await loadLabels();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "删除失败。";
  }
}

onMounted(async () => {
  await Promise.all([loadLabels(), loadKeywords(), loadBlocked()]);
});
</script>

<template>
  <div class="space-y-6">
    <!-- 用户标签管理 -->
    <SectionCard title="记忆标签" eyebrow="手动创建">
      <p v-if="error" class="status status--error">{{ error }}</p>

      <div class="toolbar">
        <input v-model="search" class="input" placeholder="搜索标签..." />
        <button class="btn btn--primary" @click="showCreate = !showCreate">
          {{ showCreate ? "取消" : "+ 新建标签" }}
        </button>
        <div class="meta-card meta-card--compact">
          <span class="meta-card__label">标签数量</span>
          <strong>{{ filteredLabels.length }}</strong>
        </div>
      </div>

      <div v-if="showCreate" class="create-form">
        <div class="form-row">
          <label class="form-label">名称</label>
          <input
            v-model="newName"
            class="input"
            placeholder="如：AI、读书、灵感"
            maxlength="100"
          />
        </div>
        <div class="form-row">
          <label class="form-label">描述（可选）</label>
          <input
            v-model="newDescription"
            class="input"
            placeholder="给这个标签加点说明"
          />
        </div>
        <div class="form-row">
          <label class="form-label">颜色</label>
          <input v-model="newColor" class="input color-input" type="color" />
        </div>
        <button
          class="btn btn--primary"
          :disabled="creating"
          @click="handleCreate"
        >
          {{ creating ? "创建中…" : "保存" }}
        </button>
      </div>

      <div class="cluster-list">
        <article
          v-for="label in filteredLabels"
          :key="label.id"
          class="cluster-list__item"
        >
          <span
            class="cluster-dot"
            :style="{ backgroundColor: label.color }"
          ></span>
          <div class="cluster-list__content">
            <h4>{{ label.name }}</h4>
            <p>{{ label.description || "暂无描述" }}</p>
          </div>
          <div class="cluster-list__actions">
            <button
              class="btn btn--ghost btn--sm"
              @click="viewLabelDocs(label)"
            >
              查看文档
            </button>
            <button
              class="btn-icon"
              title="删除标签"
              @click="handleDelete(label)"
            >
              ×
            </button>
          </div>
        </article>
      </div>

      <div v-if="filteredLabels.length === 0" class="empty-state">
        <p>没有匹配的标签。</p>
      </div>
    </SectionCard>

    <!-- 自动提取的关键词标签 -->
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
      </div>

      <div class="keyword-list">
        <article
          v-for="kw in filteredKeywords"
          :key="kw.word"
          class="keyword-item"
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
                  : 'btn--secondary'
              "
              @click="toggleBlock(kw.word)"
            >
              {{ blockedWords.has(kw.word.toLowerCase()) ? "已屏蔽" : "屏蔽" }}
            </button>
          </div>
        </article>
      </div>

      <div v-if="filteredKeywords.length === 0" class="empty-state">
        <p>没有匹配的关键词。</p>
      </div>
    </SectionCard>
  </div>
</template>

<style scoped>
.space-y-6 {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.create-form {
  background: rgba(15, 23, 42, 0.04);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 12px;
  color: var(--color-text-muted, #64748b);
}

.color-input {
  width: 64px;
  height: 36px;
  padding: 2px;
  cursor: pointer;
}

.cluster-list__item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cluster-list__content {
  flex: 1;
  min-width: 0;
}

.cluster-list__actions {
  display: flex;
  gap: 8px;
  align-items: center;
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

.btn-icon {
  background: transparent;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 18px;
  line-height: 1;
}

.btn-icon:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
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
</style>
