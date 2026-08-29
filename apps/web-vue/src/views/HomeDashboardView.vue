<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import GraphLocalView from "@/components/GraphLocalView.vue";

import {
  fetchGraph,
  fetchKnowledgeHome,
  fetchConversations,
  type GraphResponse,
  type KnowledgeHomeResponse,
  type ConversationSummary,
} from "@/lib/api";

const home = ref<KnowledgeHomeResponse | null>(null);
const graphData = ref<GraphResponse | null>(null);
const recentConversations = ref<ConversationSummary[]>([]);
const error = ref("");
const isLoading = ref(false);
const graphColorMode = ref<"type" | "community">("type");
const activeTab = ref<"overview" | "graph" | "growth">("overview");

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

function formatDateTime(value?: string | null) {
  if (!value) return "刚刚";
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN");
}

const graphNodes = computed(() => {
  if (!graphData.value?.data?.triplets) return [];
  const nodeMap = new Map<string, { id: string; label: string; type: string; primary: boolean }>();

  for (const triplet of graphData.value.data.triplets) {
    if (!nodeMap.has(triplet.sourceNode.uuid)) {
      const type =
        (triplet.sourceNode.labels[0] as string | undefined) ||
        (triplet.sourceNode.attributes.type as string | undefined) ||
        "Concept";
      nodeMap.set(triplet.sourceNode.uuid, {
        id: triplet.sourceNode.uuid,
        label: triplet.sourceNode.name,
        type,
        primary: true,
      });
    }

    if (!nodeMap.has(triplet.targetNode.uuid)) {
      const type =
        (triplet.targetNode.labels[0] as string | undefined) ||
        (triplet.targetNode.attributes.type as string | undefined) ||
        "Concept";
      nodeMap.set(triplet.targetNode.uuid, {
        id: triplet.targetNode.uuid,
        label: triplet.targetNode.name,
        type,
        primary: true,
      });
    }
  }

  return Array.from(nodeMap.values());
});

const graphEdges = computed(() => {
  if (!graphData.value?.data?.triplets) return [];
  return graphData.value.data.triplets.map((triplet) => ({
    id: triplet.edge.uuid,
    source: triplet.sourceNode.uuid,
    target: triplet.targetNode.uuid,
    label: triplet.edge.type,
    weight: 1,
    aspect: null,
  }));
});

const stats = computed(() => {
  if (!home.value) return { totalGrowth: 0, pendingReview: 0, activeProjects: 0, totalConvs: 0 };
  return {
    totalGrowth: home.value.recentGrowth.length + home.value.recentEvents.length + home.value.recentDecisions.length,
    pendingReview: home.value.reviewQueue.count,
    activeProjects: home.value.activeProjects.length,
    totalConvs: recentConversations.value.length,
  };
});

const todayTrend = computed(() => {
  const points = home.value?.learningTrend ?? [];
  const today = points[points.length - 1];
  if (!today) return { proposed: 0, accepted: 0 };
  return { proposed: today.proposed, accepted: today.accepted };
});

async function loadHome() {
  isLoading.value = true;
  error.value = "";

  try {
    const [homeData, graph, convs] = await Promise.all([
      fetchKnowledgeHome(),
      fetchGraph(80),
      fetchConversations().then(r => r.conversations.slice(0, 5)),
    ]);
    home.value = homeData;
    graphData.value = graph;
    recentConversations.value = convs;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "加载首页失败。";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadHome();
});
</script>

<template>
  <div class="home-dashboard">
    <!-- 欢迎区域 -->
    <header class="home-dashboard__welcome">
      <div>
        <p class="home-dashboard__eyebrow">个人知识沉淀系统</p>
        <h1>欢迎回来 👋</h1>
        <p class="home-dashboard__subtitle">这是你的第二大脑，记录着你的思考与成长</p>
      </div>
      <div class="home-dashboard__quick-actions">
        <RouterLink class="button button--primary" to="/home/conversation">
          💬 开始对话
        </RouterLink>
        <RouterLink class="button" to="/home/memory/graph/inbox">
          📥 处理收件箱
        </RouterLink>
      </div>
    </header>

    <p v-if="error" class="home-dashboard__error">{{ error }}</p>

    <template v-else-if="home">
      <!-- 统计卡片 -->
      <section class="home-dashboard__stats">
        <article class="stat-card">
          <div class="stat-card__icon">📊</div>
          <div class="stat-card__content">
            <span class="stat-card__value">{{ stats.totalGrowth }}</span>
            <span class="stat-card__label">今日知识增长</span>
          </div>
        </article>

        <article class="stat-card stat-card--accent">
          <div class="stat-card__icon">📥</div>
          <div class="stat-card__content">
            <span class="stat-card__value">{{ stats.pendingReview }}</span>
            <span class="stat-card__label">待确认项</span>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-card__icon">🔗</div>
          <div class="stat-card__content">
            <span class="stat-card__value">{{ stats.activeProjects }}</span>
            <span class="stat-card__label">活跃项目</span>
          </div>
        </article>

        <article class="stat-card">
          <div class="stat-card__icon">💬</div>
          <div class="stat-card__content">
            <span class="stat-card__value">{{ stats.totalConvs }}</span>
            <span class="stat-card__label">最近对话</span>
          </div>
        </article>
      </section>

      <!-- 标签页切换 -->
      <section class="home-dashboard__tabs">
        <button
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === 'overview' }"
          @click="activeTab = 'overview'"
        >
          📋 概览
        </button>
        <button
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === 'graph' }"
          @click="activeTab = 'graph'"
        >
          🕸️ 知识图谱
        </button>
        <button
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === 'growth' }"
          @click="activeTab = 'growth'"
        >
          📈 成长轨迹
        </button>
      </section>

      <!-- 概览面板 -->
      <section v-show="activeTab === 'overview'" class="home-dashboard__overview">
        <div class="overview-grid">
          <!-- 最近对话 -->
          <article class="panel-card">
            <div class="panel-card__head">
              <p class="panel-card__eyebrow">最近对话</p>
              <RouterLink class="panel-card__link" to="/home/conversation">查看全部</RouterLink>
            </div>
            <div class="story-list">
              <RouterLink
                v-for="conv in recentConversations"
                :key="conv.id"
                :to="`/home/conversation/${conv.id}`"
                class="story-item"
              >
                <div class="story-item__meta">
                  <strong>{{ conv.title || "未命名对话" }}</strong>
                  <span>{{ formatDateTime(conv.updatedAt) }}</span>
                </div>
                <span v-if="conv.unread" class="story-item__badge">未读</span>
              </RouterLink>
              <p v-if="recentConversations.length === 0" class="empty-state">
                还没有对话，开始你的第一次对话吧！
              </p>
            </div>
          </article>

          <!-- 今日学习 -->
          <article class="panel-card">
            <div class="panel-card__head">
              <p class="panel-card__eyebrow">今日学习</p>
            </div>
            <div class="today-stats">
              <div class="today-stat">
                <span class="today-stat__value">+{{ todayTrend.proposed }}</span>
                <span class="today-stat__label">新发现</span>
              </div>
              <div class="today-stat">
                <span class="today-stat__value">+{{ todayTrend.accepted }}</span>
                <span class="today-stat__label">已确认</span>
              </div>
            </div>
          </article>

          <!-- 快速入口 -->
          <article class="panel-card">
            <div class="panel-card__head">
              <p class="panel-card__eyebrow">快速入口</p>
            </div>
            <div class="quick-links">
              <RouterLink to="/home/memory/graph/inbox" class="quick-link">
                <span class="quick-link__icon">📥</span>
                <span>学习收件箱</span>
              </RouterLink>
              <RouterLink to="/home/memory/graph" class="quick-link">
                <span class="quick-link__icon">🕸️</span>
                <span>知识图谱</span>
              </RouterLink>
              <RouterLink to="/home/memory/documents" class="quick-link">
                <span class="quick-link__icon">📄</span>
                <span>文档记忆</span>
              </RouterLink>
              <RouterLink to="/home/wiki" class="quick-link">
                <span class="quick-link__icon">📚</span>
                <span>维基</span>
              </RouterLink>
            </div>
          </article>
        </div>
      </section>

      <!-- 知识图谱面板 -->
      <section v-show="activeTab === 'graph'" class="home-dashboard__graph">
        <GraphLocalView
          title="知识图谱总览"
          :nodes="graphNodes"
          :edges="graphEdges"
          :color-mode="graphColorMode"
        />
      </section>

      <!-- 成长轨迹面板 -->
      <section v-show="activeTab === 'growth'" class="home-dashboard__growth">
        <div class="growth-grid">
          <article class="panel-card panel-card--trend">
            <div class="panel-card__head">
              <p class="panel-card__eyebrow">学习趋势</p>
            </div>
            <div class="trend-chart">
              <div v-for="bar in home.learningTrend" :key="bar.date" class="trend-chart__item">
                <div class="trend-chart__bars">
                  <span
                    class="trend-chart__bar trend-chart__bar--accepted"
                    :style="{ height: `${Math.max(8, bar.accepted * 10)}px` }"
                  ></span>
                  <span
                    class="trend-chart__bar trend-chart__bar--proposed"
                    :style="{ height: `${Math.max(8, bar.proposed * 10)}px` }"
                  ></span>
                </div>
                <small>{{ bar.date.slice(5) }}</small>
              </div>
            </div>
          </article>

          <article class="panel-card">
            <div class="panel-card__head">
              <p class="panel-card__eyebrow">最近成长</p>
              <RouterLink class="panel-card__link" to="/home/memory/graph/inbox">全部</RouterLink>
            </div>
            <div class="story-list">
              <RouterLink
                v-for="item in home.recentGrowth"
                :key="item.id"
                :to="`/home/memory/graph/object/${encodeURIComponent(item.graphObjectId || '')}`"
                class="story-item"
              >
                <div class="story-item__meta">
                  <strong>{{ item.title }}</strong>
                  <span>{{ kindLabel(item.kind) }} · {{ formatDateTime(item.updatedAt) }}</span>
                </div>
                <span class="story-item__badge">{{ item.confidence?.toFixed(2) }}</span>
              </RouterLink>
            </div>
          </article>

          <article class="panel-card">
            <div class="panel-card__head">
              <p class="panel-card__eyebrow">最近事件</p>
            </div>
            <div class="story-list">
              <RouterLink
                v-for="item in home.recentEvents"
                :key="item.id"
                :to="`/home/memory/graph/object/${encodeURIComponent(item.graphObjectId || '')}`"
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
              <p class="panel-card__eyebrow">最近决策</p>
            </div>
            <div class="story-list">
              <RouterLink
                v-for="item in home.recentDecisions"
                :key="item.id"
                :to="`/home/memory/graph/object/${encodeURIComponent(item.graphObjectId || '')}`"
                class="story-item"
              >
                <div class="story-item__meta">
                  <strong>{{ item.title }}</strong>
                  <span>{{ formatDateTime(item.updatedAt) }}</span>
                </div>
              </RouterLink>
            </div>
          </article>
        </div>
      </section>
    </template>

    <div v-else class="home-dashboard__loading">
      <div class="loading-spinner"></div>
      <p>正在加载你的知识世界...</p>
    </div>
  </div>
</template>

<style scoped>
.home-dashboard {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  animation: fadeIn 0.6s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.home-dashboard__welcome {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: linear-gradient(135deg, rgba(201, 99, 61, 0.12), rgba(77, 106, 181, 0.08));
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
  animation: slideDown 0.5s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.home-dashboard__welcome h1 {
  margin: 8px 0 12px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 2.2rem;
}

.home-dashboard__subtitle {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.95rem;
}

.home-dashboard__eyebrow {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.home-dashboard__quick-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.9);
  color: inherit;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(89, 50, 19, 0.12);
}

.button--primary {
  background: linear-gradient(135deg, #c9633d, #9f4424);
  color: white;
  border: none;
}

.button--ghost {
  background: transparent;
}

.home-dashboard__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  animation: fadeIn 0.7s ease 0.1s both;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 28px 90px rgba(89, 50, 19, 0.12);
}

.stat-card--accent {
  background: linear-gradient(135deg, rgba(201, 99, 61, 0.16), rgba(255, 250, 244, 0.9));
}

.stat-card__icon {
  font-size: 2rem;
  line-height: 1;
}

.stat-card__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-card__value {
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1;
  font-family: Georgia, "Times New Roman", serif;
}

.stat-card__label {
  font-size: 0.8rem;
  color: var(--text-soft);
}

.home-dashboard__tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: rgba(95, 64, 28, 0.06);
  border-radius: 16px;
  width: fit-content;
  animation: fadeIn 0.8s ease 0.2s both;
}

.tab-button {
  padding: 10px 20px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.5);
}

.tab-button--active {
  background: white;
  color: var(--text);
  box-shadow: 0 2px 8px rgba(89, 50, 19, 0.08);
}

.home-dashboard__overview,
.home-dashboard__graph,
.home-dashboard__growth {
  animation: fadeIn 0.9s ease 0.3s both;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel-card {
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
}

.panel-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-card__eyebrow {
  margin: 0;
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel-card__link {
  font-size: 0.85rem;
  color: var(--accent-strong);
  text-decoration: none;
  font-weight: 500;
}

.story-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.story-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(95, 64, 28, 0.08);
  background: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  color: inherit;
  transition: all 0.15s ease;
}

.story-item:hover {
  transform: translateX(4px);
  background: rgba(255, 255, 255, 0.9);
}

.story-item__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.story-item__meta strong {
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.story-item__meta span {
  font-size: 0.8rem;
  color: var(--text-soft);
}

.story-item__badge {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(201, 99, 61, 0.1);
  color: var(--accent-strong);
  font-size: 0.75rem;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-soft);
  font-size: 0.9rem;
}

.today-stats {
  display: flex;
  gap: 24px;
}

.today-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.today-stat__value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent-strong);
  font-family: Georgia, "Times New Roman", serif;
}

.today-stat__label {
  font-size: 0.85rem;
  color: var(--text-soft);
}

.quick-links {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(95, 64, 28, 0.08);
  background: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  color: inherit;
  font-size: 0.9rem;
  transition: all 0.15s ease;
}

.quick-link:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateX(4px);
}

.quick-link__icon {
  font-size: 1.3rem;
}

.home-dashboard__graph {
  min-height: 70vh;
  border-radius: 20px;
  border: 1px solid rgba(95, 64, 28, 0.14);
  background: rgba(255, 250, 244, 0.84);
  box-shadow: 0 24px 80px rgba(89, 50, 19, 0.08);
  overflow: hidden;
}

.growth-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  min-height: 160px;
  padding: 10px 0;
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
  transition: height 0.4s ease;
}

.trend-chart__bar--accepted {
  background: #2f7d80;
}

.trend-chart__bar--proposed {
  background: rgba(201, 99, 61, 0.6);
}

.home-dashboard__error {
  text-align: center;
  padding: 40px;
  color: #c9633d;
  background: rgba(201, 99, 61, 0.08);
  border-radius: 16px;
}

.home-dashboard__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 400px;
  color: var(--text-soft);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(95, 64, 28, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1180px) {
  .home-dashboard__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview-grid,
  .growth-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .home-dashboard {
    padding: 14px;
  }

  .home-dashboard__welcome {
    flex-direction: column;
  }

  .home-dashboard__stats {
    grid-template-columns: 1fr;
  }

  .quick-links {
    grid-template-columns: 1fr;
  }
}
</style>
