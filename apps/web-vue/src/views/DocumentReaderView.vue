<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import SectionCard from "@/components/SectionCard.vue";
import {
  fetchDocument,
  updateDocumentApi,
  deleteDocumentApi,
  type DocumentRecord,
} from "@/lib/api";

const router = useRouter();
const route = useRoute();

const documentId = route.params.documentId as string;

const doc = ref<DocumentRecord | null>(null);
const loading = ref(true);
const error = ref("");
const editing = ref(false);
const saving = ref(false);
const editForm = ref({ title: "", content: "", createdAt: "" });

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

function startEdit() {
  if (!doc.value) return;
  editForm.value = {
    title: doc.value.title,
    content: doc.value.content || "",
    createdAt: toLocalDatetime(new Date(doc.value.createdAt)),
  };
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  error.value = "";
}

async function saveEdit() {
  if (!doc.value) return;
  saving.value = true;
  error.value = "";

  try {
    const isoDate = editForm.value.createdAt
      ? new Date(editForm.value.createdAt).toISOString()
      : undefined;

    const res = await updateDocumentApi(doc.value.id, {
      title: editForm.value.title.trim(),
      content: editForm.value.content.trim(),
      createdAt: isoDate,
    });

    doc.value = res.document;
    editing.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "保存失败";
  } finally {
    saving.value = false;
  }
}

async function deleteDoc() {
  if (!doc.value) return;
  if (!confirm("确定要删除这篇文档吗？")) return;

  try {
    await deleteDocumentApi(doc.value.id);
    router.push("/home/memory/documents");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "删除失败";
  }
}

function goBack() {
  router.push("/home/memory/documents");
}

onMounted(async () => {
  try {
    const res = await fetchDocument(documentId);
    doc.value = res.document;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载文档失败";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <SectionCard :title="doc?.title || '文档详情'" eyebrow="查看和编辑文档内容">
    <p v-if="error" class="status status--error">{{ error }}</p>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else-if="doc">
      <!-- 阅读模式 -->
      <template v-if="!editing">
        <div class="doc-meta">
          <span class="meta-item">
            <strong>创建时间：</strong>{{ formatDateTime(doc.createdAt) }}
          </span>
          <span class="meta-item">
            <strong>来源：</strong>{{ doc.source || "手动录入" }}
          </span>
          <span class="meta-item">
            <strong>类型：</strong>{{ doc.type || "text" }}
          </span>
        </div>

        <div class="doc-content">{{ doc.content }}</div>

        <div class="doc-actions">
          <button class="button" @click="startEdit">编辑</button>
          <button class="button button--ghost" @click="goBack">返回列表</button>
          <button class="button button--danger" @click="deleteDoc">删除</button>
        </div>
      </template>

      <!-- 编辑模式 -->
      <template v-else>
        <div class="edit-form">
          <div class="form-group">
            <label>标题</label>
            <input v-model="editForm.title" class="input" />
          </div>

          <div class="form-group">
            <label>创建日期</label>
            <input
              v-model="editForm.createdAt"
              type="datetime-local"
              class="input"
            />
          </div>

          <div class="form-group">
            <label>内容</label>
            <textarea
              v-model="editForm.content"
              class="input textarea"
              rows="20"
            ></textarea>
          </div>

          <div class="edit-actions">
            <button class="button" :disabled="saving" @click="saveEdit">
              {{ saving ? "保存中..." : "保存" }}
            </button>
            <button class="button button--ghost" @click="cancelEdit">
              取消
            </button>
          </div>
        </div>
      </template>
    </template>
  </SectionCard>
</template>

<style scoped>
.loading {
  text-align: center;
  padding: 40px;
  color: #888;
}

.doc-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 14px;
  color: #555;
}

.meta-item strong {
  color: #333;
}

.doc-content {
  white-space: pre-wrap;
  line-height: 1.7;
  font-size: 15px;
  color: #222;
  padding: 20px 0;
  border-top: 1px solid #eee;
}

.doc-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.button--danger {
  background: #ef4444;
  color: #fff;
  margin-left: auto;
}

.button--danger:hover {
  background: #dc2626;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.textarea {
  resize: vertical;
  min-height: 400px;
  font-family: monospace;
  line-height: 1.6;
}

.edit-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
