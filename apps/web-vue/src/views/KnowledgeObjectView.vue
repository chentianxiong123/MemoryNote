<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import GraphLocalView from "@/components/GraphLocalView.vue";
import {
  fetchKnowledgeObject,
  fetchKnowledgeObjectGraph,
  type KnowledgeCaptureItemRecord,
  type KnowledgeObjectDetailResponse,
  type KnowledgeObjectGraphResponse,
} from "@/lib/api";

const route = useRoute();

const detail = ref<KnowledgeObjectDetailResponse | null>(null);
const graph = ref<KnowledgeObjectGraphResponse | null>(null);
const error = ref("");
const isLoading = ref(false);
const graphDepth = ref(1);
const selectedNodeId = ref<string | null>(null);
const selectedEdgeId = ref<string | null>(null);

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

    <template v-else-if="detail && graph">
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
            <span class="chip">depth {{ graph.meta.depth }}</span>
          </div>
          <GraphLocalView
            title="局部关系图"
            :nodes="graph.nodes"
            :edges="graph.edges"
            :selected-node-id="selectedNodeId"
            :selected-edge-id="selectedEdgeId"
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
.panel-card {
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
.evidence-item__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
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
