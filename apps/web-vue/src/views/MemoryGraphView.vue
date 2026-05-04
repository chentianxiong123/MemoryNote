<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import {
  fetchKnowledgeHome,
  type KnowledgeHomeResponse,
} from "@/lib/api";

const home = ref<KnowledgeHomeResponse | null>(null);
const error = ref("");
const isLoading = ref(false);

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    entity: "对象",
    relation: "关系",
    event: "事件",
    decision: "决策",
    statement: "陈述",
  };
  return labels[kind] || kind;
}

function typeLabel(type: string) {
  return type || "Concept";
}

function objectHref(item: { graphObjectId?: string | null }) {
  if (item.graphObjectId) {
    return `/home/memory/graph/object/${encodeURIComponent(item.graphObjectId)}`;
  }
  return "/home/memory/graph/inbox";
}

function formatDateTime(value?: string | null) {
  if (!value) return "刚刚";
  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadHome() {
  isLoading.value = true;
  error.value = "";

  try {
    home.value = await fetchKnowledgeHome();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载知识工作台失败。";
    home.value = null;
  } finally {
    isLoading.value = false;
  }
}

const trendBars = computed(() => {
  const points = home.value?.learningTrend ?? [];
  const max = Math.max(
    1,
    ...points.map((point) => Math.max(point.proposed, point.accepted)),
  );

  return points.map((point) => ({
    ...point,
    proposedHeight: Math.max(10, (point.proposed / max) * 96),
    acceptedHeight: Math.max(8, (point.accepted / max) * 88),
    label: point.date.slice(5),
  }));
});

const recentNarrative = computed(() => (home.value?.recentGrowth ?? []).slice(0, 3));

onMounted(() => {
  void loadHome();
});
</script>

<template>
  <div class="knowledge-home">
    <header class="knowledge-home__header">
      <div>
        <p class="knowledge-home__eyebrow">AI-driven Personal Knowledge Workbench</p>
        <h1>知识工作台</h1>
        <p class="knowledge-home__intro">
          先看学习增长和待确认知识，不直接把整张图铺出来。图只在对象详情里承担解释作用。
        </p>
      </div>

      <div class="knowledge-home__actions">
        <RouterLink class="button" to="/home/memory/graph/inbox">打开学习收件箱</RouterLink>
        <button class="button button--ghost" :disabled="isLoading" @click="loadHome">
          {{ isLoading ? "刷新中..." : "刷新工作台" }}
        </button>
      </div>
    </header>

    <p v-if="error" class="knowledge-home__error">{{ error }}</p>

    <template v-else-if="home">
      <section class="knowledge-home__hero">
        <article class="hero-card hero-card--accent">
          <span class="hero-card__label">待确认项</span>
          <strong>{{ home.reviewQueue.count }}</strong>
          <p>来自 {{ home.reviewQueue.batchesCount }} 个最近的 recap batch</p>
          <RouterLink class="hero-card__link" to="/home/memory/graph/inbox">去处理</RouterLink>
        </article>

        <article class="hero-card">
          <span class="hero-card__label">最近增长</span>
          <strong>{{ home.recentGrowth.length }}</strong>
          <p>最近被确认进入长期知识层的对象和关系</p>
        </article>

        <article class="hero-card">
          <span class="hero-card__label">活跃项目</span>
          <strong>{{ home.activeProjects.length }}</strong>
          <p>当前与你的学习和工作联系最强的项目对象</p>
        </article>
      </section>

      <section class="knowledge-home__grid">
        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Recent Growth</p>
            <RouterLink class="panel-card__link" to="/home/memory/graph/inbox">全部候选</RouterLink>
          </div>
          <div class="story-list">
            <RouterLink
              v-for="item in home.recentGrowth"
              :key="item.id"
              :to="objectHref(item)"
              class="story-item"
            >
              <div class="story-item__meta">
                <strong>{{ item.title }}</strong>
                <span>{{ kindLabel(item.kind) }} · {{ formatDateTime(item.updatedAt) }}</span>
              </div>
              <span class="story-item__badge">{{ item.confidence?.toFixed(2) ?? "--" }}</span>
            </RouterLink>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Recent Recaps</p>
            <RouterLink class="panel-card__link" to="/home/memory/graph/inbox">进入收件箱</RouterLink>
          </div>
          <div class="story-list">
            <article
              v-for="batch in home.recentBatches"
              :key="batch.id"
              class="story-item story-item--plain"
            >
              <div class="story-item__meta">
                <strong>{{ batch.summary }}</strong>
                <span>{{ formatDateTime(batch.createdAt) }}</span>
              </div>
              <span class="story-item__badge">{{ batch.counts.proposed }} 待处理</span>
            </article>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Active Projects</p>
          </div>
          <div class="chip-grid">
            <RouterLink
              v-for="project in home.activeProjects"
              :key="project.id"
              :to="`/home/memory/graph/object/${encodeURIComponent(project.id)}`"
              class="chip-card"
            >
              <strong>{{ project.title }}</strong>
              <span>{{ project.weight }} 条连接</span>
            </RouterLink>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Active Topics</p>
          </div>
          <div class="chip-grid">
            <RouterLink
              v-for="topic in home.activeTopics"
              :key="topic.id"
              :to="`/home/memory/graph/object/${encodeURIComponent(topic.id)}`"
              class="chip-card"
            >
              <strong>{{ topic.title }}</strong>
              <span>{{ typeLabel(topic.type) }} · {{ topic.weight }}</span>
            </RouterLink>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Recent Decisions</p>
          </div>
          <div class="story-list">
            <RouterLink
              v-for="item in home.recentDecisions"
              :key="item.id"
              :to="objectHref(item)"
              class="story-item"
            >
              <div class="story-item__meta">
                <strong>{{ item.title }}</strong>
                <span>{{ formatDateTime(item.updatedAt) }}</span>
              </div>
            </RouterLink>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Recent Events</p>
          </div>
          <div class="story-list">
            <RouterLink
              v-for="item in home.recentEvents"
              :key="item.id"
              :to="objectHref(item)"
              class="story-item"
            >
              <div class="story-item__meta">
                <strong>{{ item.title }}</strong>
                <span>{{ formatDateTime(item.updatedAt) }}</span>
              </div>
            </RouterLink>
          </div>
        </article>
      </section>

      <section class="knowledge-home__bottom">
        <article class="panel-card panel-card--trend">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Learning Trend</p>
          </div>
          <div class="trend-chart">
            <div v-for="bar in trendBars" :key="bar.date" class="trend-chart__item">
              <div class="trend-chart__bars">
                <span class="trend-chart__bar trend-chart__bar--accepted" :style="{ height: `${bar.acceptedHeight}px` }"></span>
                <span class="trend-chart__bar trend-chart__bar--proposed" :style="{ height: `${bar.proposedHeight}px` }"></span>
              </div>
              <small>{{ bar.label }}</small>
            </div>
          </div>
        </article>

        <article class="panel-card">
          <div class="panel-card__head">
            <p class="panel-card__eyebrow">Recent Narrative</p>
          </div>
          <div class="story-list">
            <article
              v-for="item in recentNarrative"
              :key="item.id"
              class="story-item story-item--plain"
            >
              <div class="story-item__meta">
                <strong>{{ item.title }}</strong>
                <span>{{ kindLabel(item.kind) }} · {{ item.status }}</span>
              </div>
              <p>{{ item.evidence?.assistantMessage ?? "该对象来自最近一次 AI 对话提炼。" }}</p>
            </article>
          </div>
        </article>
      </section>
    </template>

    <div v-else class="knowledge-home__loading">正在加载知识工作台...</div>
  </div>
</template>

<style scoped>
.knowledge-home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
  background:
    radial-gradient(circle at top left, rgba(201, 99, 61, 0.12), transparent 24rem),
    radial-gradient(circle at bottom right, rgba(77, 106, 181, 0.08), transparent 28rem),
    linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(244, 237, 228, 0.96));
}

.knowledge-home__header,
.hero-card,
.panel-card {
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.knowledge-home__header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
}

.knowledge-home__header h1 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 2rem;
}

.knowledge-home__eyebrow,
.panel-card__eyebrow,
.hero-card__label {
  margin: 0 0 6px;
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.knowledge-home__intro,
.knowledge-home__error,
.knowledge-home__loading,
.story-item__meta span,
.chip-card span,
.hero-card p,
.panel-card__link,
.story-item p {
  color: var(--text-soft);
}

.knowledge-home__actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.knowledge-home__hero {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.hero-card {
  padding: 16px;
}

.hero-card--accent {
  background: linear-gradient(180deg, rgba(201, 99, 61, 0.16), rgba(255, 250, 244, 0.9));
}

.hero-card strong {
  display: block;
  font-size: 2rem;
  line-height: 1;
}

.hero-card__link {
  display: inline-flex;
  margin-top: 10px;
  color: var(--accent-strong);
  text-decoration: none;
  font-weight: 700;
}

.knowledge-home__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.knowledge-home__bottom {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 14px;
}

.panel-card {
  padding: 16px;
}

.panel-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-card__link {
  text-decoration: none;
  font-size: 0.88rem;
}

.story-list,
.chip-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.story-item,
.chip-card {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(95, 64, 28, 0.12);
  background: rgba(255, 255, 255, 0.82);
  text-decoration: none;
  color: inherit;
}

.story-item--plain {
  text-decoration: none;
}

.story-item__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.story-item__meta strong {
  line-height: 1.35;
}

.story-item__badge {
  align-self: flex-start;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(201, 99, 61, 0.1);
  color: var(--accent-strong);
  font-size: 0.82rem;
}

.chip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chip-card {
  flex-direction: column;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  min-height: 140px;
}

.trend-chart__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.trend-chart__bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  min-height: 100px;
}

.trend-chart__bar {
  width: 12px;
  border-radius: 999px 999px 4px 4px;
}

.trend-chart__bar--accepted {
  background: #2f7d80;
}

.trend-chart__bar--proposed {
  background: rgba(201, 99, 61, 0.6);
}

@media (max-width: 1180px) {
  .knowledge-home__hero,
  .knowledge-home__grid,
  .knowledge-home__bottom {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .knowledge-home {
    padding: 14px;
  }

  .knowledge-home__header {
    flex-direction: column;
  }

  .chip-grid {
    grid-template-columns: 1fr;
  }
}
</style>
