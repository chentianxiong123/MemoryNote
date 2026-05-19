import { createRouter, createWebHistory } from "vue-router";

import ConversationView from "@/views/ConversationView.vue";
import KnowledgeInboxView from "@/views/KnowledgeInboxView.vue";
import KnowledgeObjectView from "@/views/KnowledgeObjectView.vue";
import MemoryDocumentsView from "@/views/MemoryDocumentsView.vue";
import MemoryGraphView from "@/views/MemoryGraphView.vue";
import MemoryLabelsView from "@/views/MemoryLabelsView.vue";
import SettingsModelsView from "@/views/SettingsModelsView.vue";
import WikiEntryView from "@/views/WikiEntryView.vue";
import WikiListView from "@/views/WikiListView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/home/conversation" },
    { path: "/conversation", redirect: "/home/conversation" },
    { path: "/conversation/:conversationId", redirect: (to) => `/home/conversation/${to.params.conversationId}` },
    { path: "/memory/documents", redirect: "/home/memory/documents" },
    { path: "/memory/graph", redirect: "/home/memory/graph" },
    { path: "/memory/labels", redirect: "/home/memory/labels" },
    { path: "/settings/models", redirect: "/settings/workspace/models" },
    { path: "/home", redirect: "/home/conversation" },
    { path: "/home/daily", redirect: "/home/conversation" },
    { path: "/home/conversation", component: ConversationView },
    { path: "/home/conversation/:conversationId", component: ConversationView, props: true },
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

export default router;
