<script setup lang="ts">
import { computed, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";

import { useSessionStore } from "@/stores/session";

const route = useRoute();
const session = useSessionStore();

const sections = [
  { label: "对话", to: "/home/conversation", description: "主工作区：AI 对话与会话历史" },
  { label: "文档记忆", to: "/home/memory/documents", description: "已存储的记忆文档" },
  { label: "知识工作台", to: "/home/memory/graph", description: "复盘、确认候选记忆与查看局部关系" },
  { label: "标签", to: "/home/memory/labels", description: "记忆标签与分类" },
  { label: "模型设置", to: "/settings/workspace/models", description: "工作区模型路由" },
];

const title = computed(() => {
  if (route.path.startsWith("/home/memory/graph")) return "知识工作台";
  if (route.path.startsWith("/home/memory/labels")) return "记忆标签";
  if (route.path.startsWith("/home/memory/documents")) return "记忆文档";
  if (route.path.startsWith("/settings")) return "模型设置";
  return "对话";
});

const isGraphRoute = computed(() => route.path.startsWith("/home/memory/graph"));

watch(
  title,
  (value) => {
    document.title = `MemoryNote · ${value}`;
  },
  { immediate: true },
);
</script>

<template>
  <div class="shell" :class="{ 'shell--graph': isGraphRoute }">
    <aside v-if="!isGraphRoute" class="shell__sidebar">
      <div class="brand">
        <div class="brand__badge">MN</div>
        <div>
          <p class="brand__eyebrow">Vue 重构版</p>
          <h1 class="brand__title">MemoryNote</h1>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in sections"
          :key="item.to"
          :to="item.to"
          class="nav__item"
          :class="{ 'nav__item--active': route.path.startsWith(item.to) }"
        >
          <span class="nav__label">{{ item.label }}</span>
          <span class="nav__description">{{ item.description }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-card">
        <p class="sidebar-card__label">当前工作区</p>
        <p class="sidebar-card__value">{{ session.user?.workspaceId ?? "加载中..." }}</p>
        <p class="sidebar-card__hint">知识工作台是对话后的整理层，不替代主对话界面。</p>
      </div>
    </aside>

    <main class="shell__content" :class="{ 'shell__content--graph': isGraphRoute }">
      <header v-if="!isGraphRoute" class="shell__header">
        <div>
          <p class="shell__eyebrow">个人知识工作台</p>
          <h2 class="shell__headline">{{ title }}</h2>
        </div>
        <div class="shell__meta">
          <span class="chip">{{ session.user?.name ?? "MemoryNote 用户" }}</span>
          <span class="chip chip--accent">{{ session.user?.email ?? "加载中..." }}</span>
        </div>
      </header>

      <section class="shell__panel" :class="{ 'shell__panel--graph': isGraphRoute }">
        <RouterView />
      </section>
    </main>
  </div>
</template>
