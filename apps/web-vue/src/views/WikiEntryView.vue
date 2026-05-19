<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import {
  fetchWikiEntry,
  fetchWikiEntryTimeline,
  fetchWikiEntryVersions,
  type WikiEntryResponse,
  type WikiEntryVersionResponse,
  type WikiTimelineItem,
} from "@/lib/api";

const route = useRoute();

const entry = ref<WikiEntryResponse | null>(null);
const timeline = ref<WikiTimelineItem[]>([]);
const versions = ref<WikiEntryVersionResponse[]>([]);
const error = ref("");
const isLoading = ref(false);
const expandedVersions = ref<Set<string>>(new Set());

const entityUuid = computed(() => route.params.entityUuid as string);

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

function renderMarkdown(content: string): string {
  if (!content) return "";
  let html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = `<p>${html}</p>`;
  return html;
}

function toggleVersion(versionId: string) {
  if (expandedVersions.value.has(versionId)) {
    expandedVersions.value.delete(versionId);
  } else {
    expandedVersions.value.add(versionId);
  }
}

async function loadEntry() {
  if (!entityUuid.value) return;
  isLoading.value = true;
  error.value = "";

  try {
    const [entryResponse, timelineResponse, versionsResponse] = await Promise.all([
      fetchWikiEntry(entityUuid.value),
      fetchWikiEntryTimeline(entityUuid.value),
      fetchWikiEntryVersions(entityUuid.value),
    ]);
    entry.value = entryResponse;
    timeline.value = timelineResponse;
    versions.value = versionsResponse;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载词条详情失败。";
    entry.value = null;
    timeline.value = [];
    versions.value = [];
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => route.params.entityUuid,
  () => {
    void loadEntry();
  },
);

onMounted(() => {
  void loadEntry();
});
</script>

<template>
  <div class="wiki-entry">
    <header class="wiki-entry__header">
      <div class="wiki-entry__title">
        <RouterLink class="wiki-entry__back" to="/home/wiki">返回列表</RouterLink>
        <div>
          <p class="wiki-entry__eyebrow">Wiki Entry</p>
          <h1>{{ entry?.title ?? "词条详情" }}</h1>
          <p class="wiki-entry__definition">{{ entry?.definition ?? "正在加载词条定义..." }}</p>
        </div>
      </div>

      <div class="wiki-entry__actions">
        <RouterLink
          v-if="entry"
          class="button"
          :to="`/home/memory/graph/object/${encodeURIComponent(entry.entityUuid)}`"
        >
          在知识图谱中查看
        </RouterLink>
        <button class="button button--ghost" :disabled="isLoading" @click="loadEntry">
          {{ isLoading ? "刷新中..." : "刷新词条" }}
        </button>
      </div>
    </header>

    <p v-if="error" class="wiki-entry__error">{{ error }}</p>

    <template v-else-if="entry">
      <section class="wiki-entry__hero">
        <article class="hero-card">
          <span>创建时间</span>
          <strong>{{ formatDateTime(entry.createdAt) }}</strong>
        </article>
        <article class="hero-card">
          <span>更新时间</span>
          <strong>{{ formatDateTime(entry.updatedAt) }}</strong>
        </article>
        <article class="hero-card">
          <span>版本数</span>
          <strong>{{ versions.length }}</strong>
        </article>
        <article class="hero-card">
          <span>时间线事件</span>
          <strong>{{ timeline.length }}</strong>
        </article>
      </section>

      <section class="wiki-entry__grid">
        <article class="panel-card panel-card--main">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Summary</p>
          </div>
          <p class="panel-card__copy">{{ entry.summary || "暂无摘要" }}</p>
        </article>

        <article class="panel-card panel-card--wide">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Content</p>
          </div>
          <div
            v-if="entry.content"
            class="panel-card__content markdown-body"
            v-html="renderMarkdown(entry.content)"
          ></div>
          <p v-else class="panel-card__copy">暂无详细内容</p>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Timeline</p>
          </div>
          <div v-if="timeline.length > 0" class="timeline-list">
            <article v-for="event in timeline" :key="event.uuid" class="timeline-item">
              <strong>{{ event.fact }}</strong>
              <span>{{ event.aspect ?? "Knowledge" }} · {{ formatDateTime(event.validAt) }}</span>
              <span v-if="event.source" class="timeline-item__source">来源: {{ event.source }}</span>
            </article>
          </div>
          <p v-else class="panel-card__copy">暂无时间线事件</p>
        </article>

        <article class="panel-card panel-card--wide">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Version History</p>
            <span class="chip">{{ versions.length }} 个版本</span>
          </div>
          <div v-if="versions.length > 0" class="version-list">
            <article
              v-for="version in versions"
              :key="version.id"
              class="version-item"
              :class="{ 'version-item--expanded': expandedVersions.has(version.id) }"
            >
              <div class="version-item__head" @click="toggleVersion(version.id)">
                <div class="version-item__info">
                  <strong>版本 {{ version.version }}</strong>
                  <span>{{ formatDateTime(version.createdAt) }}</span>
                </div>
                <span class="version-item__toggle">
                  {{ expandedVersions.has(version.id) ? "收起" : "展开" }}
                </span>
              </div>
              <div v-if="expandedVersions.has(version.id)" class="version-item__body">
                <div class="version-item__section">
                  <p class="version-item__label">标题</p>
                  <p>{{ version.title }}</p>
                </div>
                <div class="version-item__section">
                  <p class="version-item__label">定义</p>
                  <p>{{ version.definition }}</p>
                </div>
                <div class="version-item__section">
                  <p class="version-item__label">摘要</p>
                  <p>{{ version.summary }}</p>
                </div>
                <div v-if="version.content" class="version-item__section">
                  <p class="version-item__label">内容</p>
                  <div
                    class="markdown-body"
                    v-html="renderMarkdown(version.content)"
                  ></div>
                </div>
              </div>
            </article>
          </div>
          <p v-else class="panel-card__copy">暂无版本历史</p>
        </article>
      </section>
    </template>

    <div v-else-if="isLoading" class="wiki-entry__loading">
      正在加载词条...
    </div>
  </div>
</template>

<style scoped>
.wiki-entry {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  background:
    radial-gradient(circle at top left, rgba(47, 125, 128, 0.12), transparent 20rem),
    linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(244, 237, 228, 0.96));
}

.wiki-entry__header,
.hero-card,
.panel-card {
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.wiki-entry__header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
}

.wiki-entry__title {
  display: flex;
  gap: 14px;
}

.wiki-entry__back {
  display: inline-flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--text);
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--line);
}

.wiki-entry__header h1,
.panel-card__title {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
}

.wiki-entry__eyebrow,
.panel-card__eyebrow {
  margin: 0 0 6px;
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.wiki-entry__definition,
.wiki-entry__error,
.panel-card__copy,
.panel-card__hint,
.timeline-item span,
.version-item__section p {
  color: var(--text-soft);
}

.wiki-entry__actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.wiki-entry__actions .button {
  text-decoration: none;
}

.wiki-entry__hero {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.hero-card {
  padding: 16px;
}

.hero-card span {
  display: block;
  color: var(--text-soft);
}

.hero-card strong {
  display: block;
  margin-top: 8px;
  font-size: 1.1rem;
}

.wiki-entry__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.panel-card {
  padding: 16px;
}

.panel-card--main {
  grid-column: 1 / -1;
}

.panel-card--wide {
  grid-column: 1 / -1;
}

.panel-card__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-card__content {
  line-height: 1.7;
}

.panel-card__copy {
  line-height: 1.6;
}

.timeline-list,
.version-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-item,
.version-item {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  background: rgba(255, 255, 255, 0.82);
}

.timeline-item strong {
  display: block;
  margin-bottom: 4px;
}

.timeline-item span {
  display: block;
  font-size: 0.86rem;
}

.timeline-item__source {
  margin-top: 4px;
  font-size: 0.8rem !important;
}

.version-item__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.version-item__info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.version-item__info strong {
  font-size: 0.95rem;
}

.version-item__info span {
  color: var(--text-soft);
  font-size: 0.86rem;
}

.version-item__toggle {
  color: var(--accent);
  font-size: 0.86rem;
}

.version-item__body {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(95, 64, 28, 0.12);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-item__section p {
  margin: 0;
}

.version-item__label {
  font-weight: 700;
  color: var(--text) !important;
  margin-bottom: 4px !important;
}

.wiki-entry__loading {
  text-align: center;
  padding: 40px;
  color: var(--text-soft);
}

.wiki-entry__error {
  padding: 16px;
  border-radius: 16px;
  background: rgba(162, 43, 43, 0.08);
  border: 1px solid rgba(162, 43, 43, 0.2);
}

.markdown-body :deep(h1) {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.4rem;
  margin: 16px 0 8px;
}

.markdown-body :deep(h2) {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.2rem;
  margin: 14px 0 6px;
}

.markdown-body :deep(h3) {
  font-size: 1.05rem;
  margin: 12px 0 4px;
}

.markdown-body :deep(p) {
  margin: 8px 0;
}

.markdown-body :deep(ul) {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(code) {
  background: rgba(95, 64, 28, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.markdown-body :deep(strong) {
  font-weight: 700;
}

.markdown-body :deep(em) {
  font-style: italic;
}

@media (max-width: 1100px) {
  .wiki-entry__hero,
  .wiki-entry__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .wiki-entry {
    padding: 14px;
  }

  .wiki-entry__header {
    flex-direction: column;
  }

  .wiki-entry__title {
    flex-direction: column;
  }

  .wiki-entry__actions {
    flex-direction: column;
  }
}
</style>
