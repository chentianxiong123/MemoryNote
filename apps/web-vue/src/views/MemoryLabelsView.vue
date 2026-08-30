<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import SectionCard from "@/components/SectionCard.vue";
import { fetchLabels, createLabel, deleteLabel, type LabelRecord } from "@/lib/api";

const labels = ref<LabelRecord[]>([]);
const error = ref("");
const search = ref("");

const showCreate = ref(false);
const newName = ref("");
const newDescription = ref("");
const newColor = ref("#3b82f6");
const creating = ref(false);

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

async function loadLabels() {
  try {
    labels.value = await fetchLabels();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "加载标签失败。";
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

onMounted(() => {
  void loadLabels();
});
</script>

<template>
  <SectionCard title="记忆标签" eyebrow="可复用的记忆分类">
    <p v-if="error" class="status status--error">{{ error }}</p>

    <div class="toolbar">
      <input v-model="search" class="input" placeholder="搜索标签名称或描述" />
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
      <article v-for="label in filteredLabels" :key="label.id" class="cluster-list__item">
        <span class="cluster-dot" :style="{ backgroundColor: label.color }"></span>
        <div class="cluster-list__content">
          <h4>{{ label.name }}</h4>
          <p>{{ label.description || "暂无描述" }}</p>
        </div>
        <button
          class="btn-icon"
          title="删除标签"
          @click="handleDelete(label)"
        >
          ×
        </button>
      </article>
    </div>

    <div v-if="filteredLabels.length === 0" class="empty-state">
      <p>没有匹配的标签。</p>
    </div>
  </SectionCard>
</template>

<style scoped>
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
</style>
