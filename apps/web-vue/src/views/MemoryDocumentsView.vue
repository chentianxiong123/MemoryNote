<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import SectionCard from "@/components/SectionCard.vue";
import {
  fetchDocuments,
  importDocument,
  searchDocumentsByKeyword,
  fetchTagCloud,
  type DocumentRecord,
} from "@/lib/api";

const router = useRouter();
const route = useRoute();

const documents = ref<DocumentRecord[]>([]);
const availableSources = ref<Array<{ name: string; slug: string }>>([]);
const error = ref("");
const search = ref("");
const selectedSource = ref("");
const activeKeyword = ref("");
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);
const loadingMore = ref(false);
const keywordDocs = ref<DocumentRecord[]>([]); // 缓存关键词搜索结果用于分页

const tags = ref<Array<{ word: string; doc_count: number }>>([]);
const loadingTags = ref(false);

const showImport = ref(false);
const importing = ref(false);
const importError = ref("");

const importForm = ref({
  title: "",
  content: "",
  createdAt: "",
});

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalDatetime(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function openDocument(doc: DocumentRecord) {
  if (doc.source === "对话" || doc.type === "conversation") {
    router.push({ path: `/home/conversation/${doc.id}` });
  } else {
    router.push({ name: "document-reader", params: { documentId: doc.id } });
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;

async function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    await loadDocuments();
  }, 300);
}

async function loadTags() {
  loadingTags.value = true;
  try {
    const res = await fetchTagCloud(2, 80);
    tags.value = res.tags.map((t: any) => ({ word: t.word, doc_count: t.doc_count }));
  } catch (e) {
    console.error("Failed to load tags", e);
  } finally {
    loadingTags.value = false;
  }
}

function selectKeyword(keyword: string) {
  if (activeKeyword.value === keyword) {
    activeKeyword.value = "";
  } else {
    activeKeyword.value = keyword;
    search.value = keyword;
  }
  void loadDocuments();
}

async function clearKeyword() {
  activeKeyword.value = "";
  search.value = "";
  await loadDocuments();
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  importForm.value.title = file.name.replace(/\.[^.]+$/, "");

  const reader = new FileReader();
  reader.onload = () => {
    importForm.value.content = reader.result as string;
  };
  reader.readAsText(file);

  const created = new Date(file.lastModified);
  importForm.value.createdAt = toLocalDatetime(created);

  showImport.value = true;
  input.value = "";
}

function openManualImport() {
  importForm.value = {
    title: "",
    content: "",
    createdAt: toLocalDatetime(new Date()),
  };
  showImport.value = true;
}

async function submitImport() {
  if (!importForm.value.title.trim() || !importForm.value.content.trim()) {
    importError.value = "标题和内容不能为空";
    return;
  }

  importing.value = true;
  importError.value = "";

  try {
    const isoDate = importForm.value.createdAt
      ? new Date(importForm.value.createdAt).toISOString()
      : undefined;

    await importDocument({
      title: importForm.value.title.trim(),
      content: importForm.value.content.trim(),
      source: "upload",
      type: "text",
      createdAt: isoDate,
    });

    showImport.value = false;
    await loadDocuments();
  } catch (err) {
    importError.value = err instanceof Error ? err.message : "导入失败";
  } finally {
    importing.value = false;
  }
}

async function loadDocuments(reset = true) {
  const isKeywordSearch = activeKeyword.value.length > 0;
  // 关键词筛选或初始化时重置；翻页时不重置但清空列表重新加载
  if (reset || isKeywordSearch) {
    documents.value = [];
    currentPage.value = 1;
  }
  loadingMore.value = true;
  try {
    const params: Record<string, string> = {};
    if (selectedSource.value) params.source = selectedSource.value;
    if (search.value.trim() && !isKeywordSearch) params.q = search.value.trim();
    if (activeKeyword.value) {
      // 关键词搜索：先加载全部结果，后续翻页从缓存中切片
      const res = await searchDocumentsByKeyword(activeKeyword.value, 200);
      const allDocs = res?.documents || [];
      if (reset) {
        keywordDocs.value = allDocs;
        totalCount.value = allDocs.length;
        totalPages.value = Math.ceil(allDocs.length / 20) || 1;
        currentPage.value = 1;
        documents.value = allDocs.slice(0, 20);
      } else {
        // 翻页：从缓存中切片
        const start = (currentPage.value - 1) * 20;
        documents.value = allDocs.slice(start, start + 20);
      }
      return;
    }
    params.page = String(currentPage.value);
    params.limit = "20";
    const response = await fetchDocuments(params);
    documents.value = response?.documents || [];
    if (reset) {
      availableSources.value = response?.availableSources || [];
    }
    totalPages.value = response?.totalPages || 1;
    totalCount.value = response?.totalCount || 0;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载文档失败。";
  } finally {
    loadingMore.value = false;
  }
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  void loadDocuments(false);
}

function prevPage() {
  if (currentPage.value > 1) {
    goToPage(currentPage.value - 1);
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    goToPage(currentPage.value + 1);
  }
}

watch(selectedSource, () => {
  void loadDocuments();
});

onMounted(() => {
  // 从标签页跳转过来时，自动搜索
  const q = route.query.q as string;
  if (q) {
    search.value = q;
    activeKeyword.value = q;
  }
  void loadDocuments();
  void loadTags();
});
</script>

<template>
  <SectionCard title="记忆文档" eyebrow="导入和管理你的记忆内容">
    <p v-if="error" class="status status--error">{{ error }}</p>

    <div class="meta-grid">
      <div class="meta-card">
        <span class="meta-card__label">文档总数</span>
        <strong>{{ totalCount }}</strong>
      </div>
      <div class="meta-card">
        <span class="meta-card__label">来源数量</span>
        <strong>{{ availableSources.length }}</strong>
      </div>
    </div>

    <div class="toolbar">
      <input
        v-model="search"
        class="input"
        placeholder="搜索文档标题或内容..."
        @input="onSearchInput"
      />
      <select v-model="selectedSource" class="select">
        <option value="">全部来源</option>
        <option
          v-for="source in availableSources"
          :key="source.slug"
          :value="source.slug"
        >
          {{ source.name }}
        </option>
      </select>
      <label class="button upload-btn">
        导入文件
        <input
          type="file"
          accept=".txt,.md,.markdown,.json,.csv,.html,.xml"
          class="file-input-hidden"
          @change="onFileSelected"
        />
      </label>
      <button class="button button--ghost" @click="openManualImport">
        手动录入
      </button>
    </div>

    <div v-if="activeKeyword" class="keyword-filter">
      <span class="keyword-filter__label">当前筛选：</span>
      <span class="keyword-filter__tag">{{ activeKeyword }}</span>
      <button class="keyword-filter__clear" @click="clearKeyword">✕</button>
    </div>

    <div class="tag-cloud">
      <span class="tag-cloud__label">热门标签：</span>
      <template v-if="loadingTags">
        <span class="tag-cloud__loading">加载中...</span>
      </template>
      <template v-else>
        <span
          v-for="tag in tags"
          :key="tag.word"
          class="tag-cloud__tag"
          :class="{ 'tag-cloud__tag--active': activeKeyword === tag.word }"
          @click="selectKeyword(tag.word)"
        >
          {{ tag.word }}
          <small>{{ tag.doc_count }}</small>
        </span>
      </template>
    </div>

    <div class="data-table">
      <div class="data-table__row data-table__row--head">
        <span>标题</span>
        <span>来源</span>
        <span>创建时间</span>
      </div>
      <div
        v-for="document in documents"
        :key="document.id"
        class="data-table__row data-table__row--clickable"
        @click="openDocument(document)"
      >
        <span class="doc-title">{{ document.title }}</span>
        <span>{{ document.source || "手动录入" }}</span>
        <span>{{ formatDateTime(document.createdAt) }}</span>
      </div>
    </div>

    <div v-if="documents.length === 0" class="empty-state">
      <p>当前条件下没有文档。</p>
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">上一页</button>
      <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页 (共 {{ totalCount }} 篇)</span>
      <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">下一页</button>
    </div>

    <Teleport to="body">
      <div
        v-if="showImport"
        class="modal-overlay"
        @click.self="showImport = false"
      >
        <div class="modal-card">
          <h3>导入文档</h3>
          <p v-if="importError" class="status status--error">
            {{ importError }}
          </p>

          <div class="form-group">
            <label>标题</label>
            <input
              v-model="importForm.title"
              class="input"
              placeholder="文档标题"
            />
          </div>

          <div class="form-group">
            <label>创建日期</label>
            <input
              v-model="importForm.createdAt"
              type="datetime-local"
              class="input"
            />
            <span class="hint">默认为文件修改日期，可手动修改</span>
          </div>

          <div class="form-group">
            <label>内容</label>
            <textarea
              v-model="importForm.content"
              class="input textarea"
              rows="12"
              placeholder="粘贴或输入文档内容..."
            ></textarea>
          </div>

          <div class="modal-actions">
            <button
              class="button"
              :disabled="importing || !importForm.content.trim()"
              @click="submitImport"
            >
              {{ importing ? "导入中..." : "确认导入" }}
            </button>
            <button class="button button--ghost" @click="showImport = false">
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </SectionCard>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.upload-btn {
  cursor: pointer;
}

.file-input-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.data-table__row--clickable {
  cursor: pointer;
  transition: background 0.15s;
}

.data-table__row--clickable:hover {
  background: #f5f5f5;
}

.doc-title {
  font-weight: 600;
  color: #2563eb;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  width: 90%;
  max-width: 640px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-card h3 {
  margin: 0 0 20px;
  font-size: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.hint {
  font-size: 12px;
  color: #888;
}

.textarea {
  resize: vertical;
  min-height: 200px;
  font-family: monospace;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.keyword-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #eff6ff;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}

.keyword-filter__label {
  color: #64748b;
}

.keyword-filter__tag {
  background: #3b82f6;
  color: #fff;
  padding: 2px 10px;
  border-radius: 12px;
  font-weight: 600;
}

.keyword-filter__clear {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.keyword-filter__clear:hover {
  color: #64748b;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.tag-cloud__label {
  font-size: 13px;
  color: #64748b;
  font-weight: 600;
}

.tag-cloud__loading {
  font-size: 13px;
  color: #94a3b8;
}

.tag-cloud__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}

.tag-cloud__tag:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.tag-cloud__tag--active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.tag-cloud__tag small {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 400;
}

.tag-cloud__tag--active small {
  color: rgba(255,255,255,0.8);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 0;
}

.page-btn {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #475569;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #64748b;
}
</style>
