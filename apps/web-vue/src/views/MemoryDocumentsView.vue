<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import SectionCard from "@/components/SectionCard.vue";
import { fetchDocuments, importDocument, type DocumentRecord } from "@/lib/api";

const documents = ref<DocumentRecord[]>([]);
const availableSources = ref<Array<{ name: string; slug: string }>>([]);
const error = ref("");
const search = ref("");
const selectedSource = ref("");

const showImport = ref(false);
const importing = ref(false);
const importError = ref("");

const importForm = ref({
  title: "",
  content: "",
  createdAt: "",
});

const filteredDocuments = computed(() => {
  const keyword = search.value.trim().toLowerCase();

  return documents.value.filter((document) => {
    const matchesSource = !selectedSource.value || document.source === selectedSource.value;
    const matchesKeyword =
      !keyword ||
      document.title.toLowerCase().includes(keyword) ||
      (document.source ?? "").toLowerCase().includes(keyword);

    return matchesSource && matchesKeyword;
  });
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
  importForm.value = { title: "", content: "", createdAt: toLocalDatetime(new Date()) };
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

async function loadDocuments() {
  try {
    const response = await fetchDocuments();
    documents.value = response.documents;
    availableSources.value = response.availableSources;
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "加载文档失败。";
  }
}

onMounted(() => {
  void loadDocuments();
});
</script>

<template>
  <SectionCard title="记忆文档" eyebrow="导入和管理你的记忆内容">
    <p v-if="error" class="status status--error">{{ error }}</p>

    <div class="meta-grid">
      <div class="meta-card">
        <span class="meta-card__label">文档数量</span>
        <strong>{{ documents.length }}</strong>
      </div>
      <div class="meta-card">
        <span class="meta-card__label">来源数量</span>
        <strong>{{ availableSources.length }}</strong>
      </div>
    </div>

    <div class="toolbar">
      <input v-model="search" class="input" placeholder="搜索文档标题或来源" />
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
      <button class="button button--ghost" @click="openManualImport">手动录入</button>
    </div>

    <div class="data-table">
      <div class="data-table__row data-table__row--head">
        <span>标题</span>
        <span>来源</span>
        <span>状态</span>
        <span>创建时间</span>
      </div>
      <div v-for="document in filteredDocuments" :key="document.id" class="data-table__row">
        <span>{{ document.title }}</span>
        <span>{{ document.source || "手动录入" }}</span>
        <span>{{ document.status || "空闲" }}</span>
        <span>{{ formatDateTime(document.createdAt) }}</span>
      </div>
    </div>

    <div v-if="filteredDocuments.length === 0" class="empty-state">
      <p>当前筛选条件下没有文档。</p>
    </div>

    <Teleport to="body">
      <div v-if="showImport" class="modal-overlay" @click.self="showImport = false">
        <div class="modal-card">
          <h3>导入文档</h3>
          <p v-if="importError" class="status status--error">{{ importError }}</p>

          <div class="form-group">
            <label>标题</label>
            <input v-model="importForm.title" class="input" placeholder="文档标题" />
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
            <button class="button" :disabled="importing || !importForm.content.trim()" @click="submitImport">
              {{ importing ? "导入中..." : "确认导入" }}
            </button>
            <button class="button button--ghost" @click="showImport = false">取消</button>
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
</style>
