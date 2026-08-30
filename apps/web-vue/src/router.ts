import { createRouter, createWebHistory } from "vue-router";

import ConversationView from "@/views/ConversationView.vue";
import KnowledgeInboxView from "@/views/KnowledgeInboxView.vue";
import KnowledgeObjectView from "@/views/KnowledgeObjectView.vue";
import MemoryDocumentsView from "@/views/MemoryDocumentsView.vue";
import MemoryGraphView from "@/views/MemoryGraphView.vue";
import MemoryLabelsView from "@/views/MemoryLabelsView.vue";
import HomeDashboardView from "@/views/HomeDashboardView.vue";
import SettingsModelsView from "@/views/SettingsModelsView.vue";
import WikiEntryView from "@/views/WikiEntryView.vue";
import WikiListView from "@/views/WikiListView.vue";
import SimpleChatView from "@/views/SimpleChatView.vue";
import LoginView from "@/views/LoginView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView, meta: { public: true } },
    { path: "/", redirect: "/home" },
    { path: "/conversation", redirect: "/home/conversation" },
    { path: "/conversation/:conversationId", redirect: (to) => `/home/conversation/${to.params.conversationId}` },
    { path: "/memory/documents", redirect: "/home/memory/documents" },
    { path: "/memory/graph", redirect: "/home/memory/graph" },
    { path: "/memory/labels", redirect: "/home/memory/labels" },
    { path: "/settings/models", redirect: "/settings/workspace/models" },
    { path: "/home", component: HomeDashboardView },
    { path: "/home/daily", redirect: "/home" },
    { path: "/home/conversation", component: SimpleChatView },
    { path: "/home/conversation/:conversationId", component: SimpleChatView, props: true },
    { path: "/home/memory/documents", component: MemoryDocumentsView },
    { path: "/home/memory/graph", component: MemoryGraphView },
    { path: "/home/memory/graph/inbox", component: KnowledgeInboxView },
    { path: "/home/memory/graph/object/:objectId", component: KnowledgeObjectView, props: true },
    { path: "/home/memory/labels", component: MemoryLabelsView },
    { path: "/home/wiki", component: WikiListView },
    { path: "/home/wiki/:entityUuid", component: WikiEntryView, props: true },
    { path: "/settings", redirect: "/settings/workspace/models" },
    { path: "/settings/workspace/models", component: SettingsModelsView },
  ],
});

// 导航守卫：未登录重定向到登录页
router.beforeEach(async (to) => {
  const publicPages = ["/login"];
  const authRequired = !publicPages.includes(to.path);
  
  if (authRequired) {
    const token = localStorage.getItem("user_token");
    if (!token) {
      return "/login";
    }
  }
  
  // 已登录访问登录页，重定向到首页
  if (to.path === "/login" && localStorage.getItem("user_token")) {
    return "/home";
  }
});

export default router;