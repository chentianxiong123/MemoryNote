<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
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

const isCollapsed = ref(false);

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
  <div class="shell" :class="{ 'shell--graph': isGraphRoute, 'shell--collapsed': isCollapsed }">
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

    <main class="shell__content" :class="{ 'shell__content--graph': isGraphRoute, 'shell__content--collapsed': isCollapsed }">
      <header class="shell__header">
        <div class="shell__header-left">
          <button class="sidebar-toggle" @click="isCollapsed = !isCollapsed" title="折叠/展开侧边栏">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6" v-if="!isCollapsed"/>
              <line x1="3" y1="12" x2="21" y2="12" v-if="!isCollapsed"/>
              <line x1="3" y1="18" x2="21" y2="18" v-if="!isCollapsed"/>
              <polyline points="15 9 21 12 15 15" v-if="isCollapsed"/>
              <polyline points="9 9 3 12 9 15" v-if="!isCollapsed"/>
            </svg>
          </button>
          <div>
            <p class="shell__eyebrow">个人知识沉淀系统</p>
            <h2 class="shell__headline">{{ title }}</h2>
          </div>
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
.sidebar-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  margin-right: 12px;
  color: var(--text-soft);
  transition: all 0.2s;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: rgba(201, 99, 61, 0.1);
  color: var(--accent);
  border-color: rgba(201, 99, 61, 0.3);
}

.shell__header-left {
  display: flex;
  align-items: center;
  gap: 0;
}

.shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 100vh;
  transition: grid-template-columns 0.3s ease;
}

.shell--collapsed {
  grid-template-columns: 0 minmax(0, 1fr);
}

.shell--collapsed .shell__sidebar {
  overflow: hidden;
  width: 0;
  padding: 0;
  border: none;
}

.shell--collapsed .brand,
.shell--collapsed .nav,
.shell--collapsed .sidebar-card {
  opacity: 0;
  pointer-events: none;
}

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
