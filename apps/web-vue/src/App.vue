<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useRoute } from "vue-router";

import AppShell from "@/components/AppShell.vue";
import { useSessionStore } from "@/stores/session";

const route = useRoute();
const session = useSessionStore();

const isLoginPage = computed(() => route.path === "/login");

onMounted(() => {
  void session.hydrate();
});
</script>

<template>
  <RouterView v-if="isLoginPage" />
  <AppShell v-else />
</template>
