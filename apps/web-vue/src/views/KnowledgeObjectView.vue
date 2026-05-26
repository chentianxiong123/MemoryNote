<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import GraphLocalView from "@/components/GraphLocalView.vue";
import {
  fetchKnowledgeObject,
  fetchKnowledgeObjectGraph,
  fetchWikiEntry,
  type KnowledgeCaptureItemRecord,
  type KnowledgeObjectDetailResponse,
  type KnowledgeObjectGraphResponse,
  type WikiEntryResponse,
} from "@/lib/api";

const route = useRoute();

const detail = ref<KnowledgeObjectDetailResponse | null>(null);
const graph = ref<KnowledgeObjectGraphResponse | null>(null);
const wikiEntry = ref<WikiEntryResponse | null>(null);
const error = ref("");
const isLoading = ref(false);
const isLoadingWiki = ref(false);
const graphDepth = ref(1);
const selectedNodeId = ref<string | null>(null);
const selectedEdgeId = ref<string | null>(null);
const colorMode = ref<"type" | "community">("type");
const wikiContentExpanded = ref(false);

const objectId = computed(() => route.params.objectId as string);

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

function evidenceSourceLabel(item: KnowledgeCaptureItemRecord) {
  const label = item.evidence?.sourceLabel;
  if (typeof label === "string" && label.trim()) return label;
  const type = item.evidence?.sourceType;
  const labels: Record<string, string> = {
    conversation: "对话",
    note: "笔记",
    document: "文档",
    web: "网页摘录",
  };
  return typeof type === "string" ? labels[type] ?? "对话" : "对话";
}

function payloadText(item: KnowledgeCaptureItemRecord, key: string) {
  const value = item.payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function evidenceText(item: KnowledgeCaptureItemRecord) {
  const sourceText = payloadText(item, "sourceText");
  if (sourceText) return sourceText;
  const assistantMessage = item.evidence?.assistantMessage;
  if (typeof assistantMessage === "string" && assistantMessage.trim()) return assistantMessage;
  const userMessage = item.evidence?.userMessage;
  if (typeof userMessage === "string" && userMessage.trim()) return userMessage;
  return "该对象来自 AI 提炼的知识候选。";
}

async function loadObject() {
  if (!objectId.value) return;
  isLoading.value = true;
  error.value = "";

  try {
    const [detailResponse, graphResponse] = await Promise.all([
      fetchKnowledgeObject(objectId.value),
      fetchKnowledgeObjectGraph(objectId.value, { depth: graphDepth.value, limit: 40 }),
    ]);
    detail.value = detailResponse;
    graph.value = graphResponse;
    selectedNodeId.value = null;
    selectedEdgeId.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载知识对象失败。";
    detail.value = null;
    graph.value = null;
  } finally {
    isLoading.value = false;
  }

  loadWikiEntry();
}

async function loadWikiEntry() {
  if (!detail.value?.object.uuid) return;
  isLoadingWiki.value = true;

  try {
    const response = await fetchWikiEntry(detail.value.object.uuid);
    wikiEntry.value = response;
  } catch {
    wikiEntry.value = null;
  } finally {
    isLoadingWiki.value = false;
  }
}

async function expandGraph() {
  graphDepth.value = 2;
  await loadObject();
}

const selectedStatement = computed(() => {
  if (!selectedEdgeId.value) return null;
  return detail.value?.object.statements.find((statement) => statement.uuid === selectedEdgeId.value) ?? null;
});

const selectedEvidence = computed(() => {
  const nodeId = selectedNodeId.value;
  if (!nodeId) return null;
  return detail.value?.object.evidence.find((item) => item.graphObjectId?.endsWith(nodeId)) ?? null;
});

watch(
  () => route.params.objectId,
  () => {
    graphDepth.value = 1;
    void loadObject();
  },
);

onMounted(() => {
  void loadObject();
});
</script>

<template>
  <div class="knowledge-object">
    <header class="knowledge-object__header">
      <div class="knowledge-object__title">
        <RouterLink class="knowledge-object__back" to="/home/memory/graph">返回工作台</RouterLink>
        <div>
          <p class="knowledge-object__eyebrow">Object Detail</p>
          <h1>{{ detail?.object.title ?? "知识对象" }}</h1>
          <p class="knowledge-object__intro">{{ detail?.object.summary ?? "正在加载对象摘要..." }}</p>
        </div>
      </div>

      <div class="knowledge-object__actions">
        <button class="button button--ghost" :disabled="isLoading" @click="loadObject">
          {{ isLoading ? "刷新中..." : "刷新对象" }}
        </button>
        <button
          class="button"
          :disabled="isLoading || graphDepth >= 2 || !graph || graph.meta.truncated === false"
          @click="expandGraph"
        >
          {{ graphDepth >= 2 ? "已展开二跳" : "展开到二跳" }}
        </button>
      </div>
    </header>

    <p v-if="error" class="knowledge-object__error">{{ error }}</p>

    <article v-if="wikiEntry && !isLoadingWiki" class="wiki-entry-card">
      <div class="wiki-entry-card__header">
        <p class="panel-card__eyebrow">Wiki 词条</p>
        <div class="wiki-entry-card__actions">
          <button
            v-if="wikiEntry.content"
            class="button button--ghost button--small"
            @click="wikiContentExpanded = !wikiContentExpanded"
          >
            {{ wikiContentExpanded ? "收起内容" : "展开全文" }}
          </button>
          <RouterLink
            class="button button--ghost button--small"
            :to="`/home/wiki/${encodeURIComponent(wikiEntry.entityUuid)}`"
          >
            查看完整词条
          </RouterLink>
        </div>
      </div>
      <h2 class="wiki-entry-card__title">{{ wikiEntry.title }}</h2>
      <p v-if="wikiEntry.definition" class="wiki-entry-card__definition">
        <strong>定义：</strong>{{ wikiEntry.definition }}
      </p>
      <p v-if="wikiEntry.summary" class="wiki-entry-card__summary">
        {{ wikiEntry.summary }}
      </p>
      <div v-if="wikiContentExpanded && wikiEntry.content" class="wiki-entry-card__content markdown-body" v-html="renderMarkdown(wikiEntry.content)"></div>
    </article>

    <template v-if="detail && graph">
      <section class="knowledge-object__hero">
        <article class="hero-card">
          <span>类型</span>
          <strong>{{ detail.object.type }}</strong>
        </article>
        <article class="hero-card">
          <span>证据数</span>
          <strong>{{ detail.object.evidenceCount }}</strong>
        </article>
        <article class="hero-card">
          <span>关系数</span>
          <strong>{{ detail.object.relationCount }}</strong>
        </article>
        <article class="hero-card">
          <span>最近出现</span>
          <strong>{{ formatDateTime(detail.object.lastSeenAt) }}</strong>
        </article>
      </section>

      <section class="knowledge-object__grid">
        <article class="panel-card panel-card--main">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Local Graph</p>
            <div class="panel-card__actions">
              <span class="chip">depth {{ graph.meta.depth }}</span>
              <button
                class="button button--ghost button--small"
                :class="{ 'button--active': colorMode === 'community' }"
                @click="colorMode = colorMode === 'type' ? 'community' : 'type'"
              >
                {{ colorMode === 'type' ? 'Type' : 'Community' }}
              </button>
            </div>
          </div>
          <GraphLocalView
            title="局部关系图"
            :nodes="graph.nodes"
            :edges="graph.edges"
            :selected-node-id="selectedNodeId"
            :selected-edge-id="selectedEdgeId"
            :color-mode="colorMode"
            @node-select="selectedNodeId = $event; selectedEdgeId = null"
            @edge-select="selectedEdgeId = $event; selectedNodeId = null"
          />
          <p class="panel-card__hint">
            默认只画一跳邻居。需要查看更多时，再手动展开到二跳，避免一上来就把图压死。
          </p>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Attributes</p>
          </div>
          <div class="attribute-list">
            <div class="attribute-item">
              <span>首次出现</span>
              <strong>{{ formatDateTime(detail.object.firstSeenAt) }}</strong>
            </div>
            <div class="attribute-item">
              <span>最近出现</span>
              <strong>{{ formatDateTime(detail.object.lastSeenAt) }}</strong>
            </div>
            <div class="attribute-item">
              <span>最近回顾</span>
              <strong>{{ formatDateTime(detail.object.lastReviewedAt) }}</strong>
            </div>
            <div class="attribute-item">
              <span>置信度</span>
              <strong>{{ detail.object.confidence?.toFixed(2) ?? "--" }}</strong>
            </div>
          </div>

          <div v-if="detail.object.relatedProjects.length > 0" class="related-block">
            <p class="panel-card__eyebrow">Related Projects</p>
            <div class="chip-list">
              <span v-for="project in detail.object.relatedProjects" :key="project.uuid" class="chip">
                {{ project.name }}
              </span>
            </div>
          </div>

          <div v-if="detail.object.aliases.length > 0" class="related-block">
            <p class="panel-card__eyebrow">Aliases</p>
            <div class="chip-list">
              <span v-for="alias in detail.object.aliases" :key="alias" class="chip">
                {{ alias }}
              </span>
            </div>
          </div>

          <div v-if="detail.object.relatedTerms.length > 0" class="related-block">
            <p class="panel-card__eyebrow">Related Terms</p>
            <div class="chip-list">
              <RouterLink
                v-for="term in detail.object.relatedTerms"
                :key="term.uuid"
                class="chip chip--link"
                :to="`/home/memory/graph/object/${encodeURIComponent(term.id)}`"
              >
                {{ term.name }}
              </RouterLink>
            </div>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Story</p>
          </div>
          <template v-if="selectedStatement">
            <h3 class="panel-card__title">{{ selectedStatement.title }}</h3>
            <p class="panel-card__copy">
              {{ selectedStatement.source.name }} → {{ selectedStatement.predicate }} → {{ selectedStatement.target.name }}
            </p>
            <div class="chip-list">
              <span class="chip">{{ selectedStatement.aspect ?? "未分类" }}</span>
              <span class="chip">{{ formatDateTime(selectedStatement.validAt) }}</span>
            </div>
          </template>
          <template v-else-if="selectedEvidence">
            <h3 class="panel-card__title">{{ selectedEvidence.title }}</h3>
            <p class="panel-card__copy">
              {{ evidenceText(selectedEvidence) }}
            </p>
          </template>
          <template v-else>
            <p class="panel-card__copy">点击关系或节点后，在这里看事实故事和上下文。</p>
          </template>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Timeline</p>
          </div>
          <div class="timeline-list">
            <article v-for="event in detail.object.timeline" :key="event.id" class="timeline-item">
              <strong>{{ event.title }}</strong>
              <span>{{ event.aspect ?? "Knowledge" }} · {{ formatDateTime(event.createdAt) }}</span>
            </article>
          </div>
        </article>

        <article class="panel-card panel-card--wide">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Evidence</p>
          </div>
          <div class="evidence-list">
            <article v-for="item in detail.object.evidence" :key="item.id" class="evidence-item">
              <div class="evidence-item__head">
                <strong>{{ item.title }}</strong>
                <span>{{ evidenceSourceLabel(item) }} · {{ formatDateTime(item.updatedAt) }}</span>
              </div>
              <p>{{ evidenceText(item) }}</p>
            </article>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.knowledge-object {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  background:
    radial-gradient(circle at top left, rgba(47, 125, 128, 0.12), transparent 20rem),
    linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(244, 237, 228, 0.96));
}

.knowledge-object__header,
.hero-card,
.panel-card,
.wiki-entry-card {
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.knowledge-object__header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
}

.knowledge-object__title {
  display: flex;
  gap: 14px;
}

.knowledge-object__back {
  display: inline-flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--text);
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--line);
}

.knowledge-object__header h1,
.panel-card__title {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
}

.knowledge-object__eyebrow,
.panel-card__eyebrow {
  margin: 0 0 6px;
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.knowledge-object__intro,
.knowledge-object__error,
.panel-card__copy,
.panel-card__hint,
.timeline-item span,
.evidence-item p,
.evidence-item__head span {
  color: var(--text-soft);
}

.knowledge-object__actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.knowledge-object__hero {
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
  font-size: 1.3rem;
}

.wiki-entry-card {
  padding: 18px 20px;
}

.wiki-entry-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.wiki-entry-card__actions {
  display: flex;
  gap: 8px;
}

.wiki-entry-card__title {
  margin: 0 0 12px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.4rem;
}

.wiki-entry-card__definition {
  margin: 0 0 10px;
  color: var(--text);
  line-height: 1.6;
}

.wiki-entry-card__definition strong {
  color: var(--text-soft);
  font-weight: 500;
}

.wiki-entry-card__summary {
  margin: 0;
  color: var(--text-soft);
  line-height: 1.6;
}

.wiki-entry-card__content {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(95, 64, 28, 0.12);
  line-height: 1.7;
}

.wiki-entry-card__content :deep(h1),
.wiki-entry-card__content :deep(h2),
.wiki-entry-card__content :deep(h3) {
  font-family: Georgia, "Times New Roman", serif;
  margin: 16px 0 8px;
}

.wiki-entry-card__content :deep(h1) { font-size: 1.4rem; }
.wiki-entry-card__content :deep(h2) { font-size: 1.2rem; }
.wiki-entry-card__content :deep(h3) { font-size: 1.05rem; }

.wiki-entry-card__content :deep(p) { margin: 8px 0; }
.wiki-entry-card__content :deep(ul),
.wiki-entry-card__content :deep(ol) { margin: 8px 0; padding-left: 20px; }
.wiki-entry-card__content :deep(li) { margin: 4px 0; }
.wiki-entry-card__content :deep(code) {
  background: rgba(95, 64, 28, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}
.wiki-entry-card__content :deep(strong) { font-weight: 700; }
.wiki-entry-card__content :deep(em) { font-style: italic; }

.button--small {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.button--active {
  background: rgba(47, 125, 128, 0.15);
  color: #2f7d80;
  border-color: rgba(47, 125, 128, 0.3);
}

.knowledge-object__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 0.9fr);
  gap: 14px;
}

.panel-card {
  padding: 16px;
}

.panel-card--main,
.panel-card--wide {
  grid-column: 1 / -1;
}

.panel-card__head,
.panel-card__actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.panel-card__actions {
  align-items: center;
}

.attribute-list,
.timeline-list,
.evidence-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.attribute-item,
.timeline-item,
.evidence-item {
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  background: rgba(255, 255, 255, 0.82);
}

.attribute-item span,
.attribute-item strong {
  display: block;
}

.attribute-item span {
  color: var(--text-soft);
}

.attribute-item strong {
  margin-top: 6px;
}

.chip-list,
.related-block {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip--link {
  text-decoration: none;
  color: inherit;
}

.related-block {
  margin-top: 16px;
  flex-direction: column;
}

@media (max-width: 1100px) {
  .knowledge-object__hero,
  .knowledge-object__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .knowledge-object {
    padding: 14px;
  }

  .knowledge-object__header {
    flex-direction: column;
  }

  .knowledge-object__title {
    flex-direction: column;
  }
}
</style>
