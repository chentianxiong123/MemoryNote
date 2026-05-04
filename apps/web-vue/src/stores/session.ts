import { defineStore } from "pinia";

import { fetchMe, type ApiMe } from "@/lib/api";

export const useSessionStore = defineStore("session", {
  state: () => ({
    user: null as ApiMe | null,
    isLoading: false,
    error: "" as string,
  }),
  actions: {
    async hydrate() {
      if (this.user || this.isLoading) return;

      this.isLoading = true;
      this.error = "";

      try {
        this.user = await fetchMe();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Failed to load current user.";
      } finally {
        this.isLoading = false;
      }
    },
  },
});
