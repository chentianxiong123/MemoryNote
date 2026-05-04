<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import SectionCard from "@/components/SectionCard.vue";
import { fetchLabels, type LabelRecord } from "@/lib/api";

const labels = ref<LabelRecord[]>([]);
const error = ref("");
const search = ref("");

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

onMounted(() => {
  void loadLabels();
});
</script>

<template>
  <SectionCard title="记忆标签" eyebrow="可复用的记忆分类">
    <p v-if="error" class="status status--error">{{ error }}</p>

    <div class="toolbar">
      <input v-model="search" class="input" placeholder="搜索标签名称或描述" />
      <div class="meta-card meta-card--compact">
        <span class="meta-card__label">标签数量</span>
        <strong>{{ filteredLabels.length }}</strong>
      </div>
    </div>

    <div class="cluster-list">
      <article v-for="label in filteredLabels" :key="label.id" class="cluster-list__item">
        <span class="cluster-dot" :style="{ backgroundColor: label.color }"></span>
        <div>
          <h4>{{ label.name }}</h4>
          <p>{{ label.description || "暂无描述" }}</p>
        </div>
      </article>
    </div>

    <div v-if="filteredLabels.length === 0" class="empty-state">
      <p>没有匹配的标签。</p>
    </div>
  </SectionCard>
</template>
