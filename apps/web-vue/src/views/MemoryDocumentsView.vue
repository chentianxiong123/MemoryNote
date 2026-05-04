<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import SectionCard from "@/components/SectionCard.vue";
import { fetchDocuments, type DocumentRecord } from "@/lib/api";

const documents = ref<DocumentRecord[]>([]);
const availableSources = ref<Array<{ name: string; slug: string }>>([]);
const error = ref("");
const search = ref("");
const selectedSource = ref("");

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
  <SectionCard title="记忆文档" eyebrow="最近写入的记忆内容">
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
    </div>

    <div class="data-table">
      <div class="data-table__row data-table__row--head">
        <span>标题</span>
        <span>来源</span>
        <span>状态</span>
        <span>更新时间</span>
      </div>
      <div v-for="document in filteredDocuments" :key="document.id" class="data-table__row">
        <span>{{ document.title }}</span>
        <span>{{ document.source || "手动录入" }}</span>
        <span>{{ document.status || "空闲" }}</span>
        <span>{{ formatDateTime(document.updatedAt) }}</span>
      </div>
    </div>

    <div v-if="filteredDocuments.length === 0" class="empty-state">
      <p>当前筛选条件下没有文档。</p>
    </div>
  </SectionCard>
</template>
