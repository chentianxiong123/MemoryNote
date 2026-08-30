<script setup lang="ts">
import { computed, watch, onMounted } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import { useSessionStore } from "@/stores/session";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const sections = [
  { label: "首页", to: "/home", description: "仪表盘、统计概览、快速入口" },
  { label: "对话", to: "/home/conversation", description: "主工作区：AI 对话与会话历史" },
  { label: "知识工作台", to: "/home/memory/graph", description: "知识图谱可视化、力导向布局、社区检测" },
  { label: "学习收件箱", to: "/home/memory/graph/inbox", description: "待确认候选记忆、批量处理" },
  { label: "文档记忆", to: "/home/memory/documents", description: "已存储的记忆文档、导入文件" },
  { label: "维基", to: "/home/wiki", description: "结构化知识库、版本历史" },
  { label: "标签", to: "/home/memory/labels", description: "记忆标签与分类管理" },
  { label: "模型设置", to: "/settings/workspace/models", description: "工作区模型路由、API Key" },
];

const title = computed(() => {
  if (route.path.startsWith("/home/memory/graph/inbox")) return "学习收件箱";
  if (route.path.startsWith("/home/memory/graph")) return "知识工作台";
  if (route.path.startsWith("/home/memory/documents")) return "文档记忆";
  if (route.path.startsWith("/home/wiki")) return "维基";
  if (route.path.startsWith("/home/memory/labels")) return "记忆标签";
  if (route.path.startsWith("/settings")) return "模型设置";
  if (route.path === "/home" || route.path.startsWith("/home/daily")) return "首页";
  return "对话";
});

const isGraphRoute = computed(() => route.path.startsWith("/home/memory/graph"));

function isNavActive(itemTo: string) {
  if (itemTo === "/home/memory/graph/inbox") {
    return route.path === "/home/memory/graph/inbox";
  }
  if (itemTo === "/home/memory/graph") {
    return (
      route.path === "/home/memory/graph" ||
      route.path.startsWith("/home/memory/graph/object")
    );
  }
  return route.path.startsWith(itemTo);
}

function handleLogout() {
  session.logout();
  router.push("/login");
}

onMounted(() => {
  session.hydrate();
});

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
    <aside class="shell__sidebar">
      <div class="brand">
        <div class="brand__badge">MN</div>
        <div>
          <p class="brand__eyebrow">知识沉淀系统</p>
          <h1 class="brand__title">MemoryNote</h1>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in sections"
          :key="item.to"
          :to="item.to"
          class="nav__item"
          :class="{ 'nav__item--active': isNavActive(item.to) }"
        >
          <span class="nav__label">{{ item.label }}</span>
          <span class="nav__description">{{ item.description }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-card">
        <p class="sidebar-card__label">当前用户</p>
        <p class="sidebar-card__value">{{ session.user?.name ?? "未登录" }}</p>
        <p class="sidebar-card__hint">{{ session.user?.email ?? "" }}</p>
        <button @click="handleLogout" class="logout-btn">退出登录</button>
      </div>
    </aside>

    <main class="shell__content" :class="{ 'shell__content--graph': isGraphRoute }">
      <header class="shell__header">
        <div>
          <p class="shell__eyebrow">个人知识沉淀系统</p>
          <h2 class="shell__headline">{{ title }}</h2>
        </div>
        <div class="shell__meta">
          <span class="chip">{{ session.user?.name ?? "用户" }}</span>
          <span class="chip chip--accent">{{ session.user?.email ?? "" }}</span>
        </div>
      </header>

      <section class="shell__panel" :class="{ 'shell__panel--graph': isGraphRoute }">
        <RouterView />
      </section>
    </main>
  </div>
</template>

<style scoped>
.logout-btn {
  margin-top: 8px;
  padding: 6px 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  width: 100%;
}

.logout-btn:hover {
  background: #c0392b;
}
</style>
