import { defineStore } from "pinia";

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  token?: string;
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    user: null as User | null,
    isLoading: false,
  }),
  actions: {
    hydrate() {
      const token = localStorage.getItem("user_token");
      const username = localStorage.getItem("user_name");
      const email = localStorage.getItem("user_email");
      
      if (token) {
        this.user = {
          id: token,
          username: username || token,
          name: username || token,
          email: email || "local",
          token,
        };
      }
    },
    logout() {
      this.user = null;
      localStorage.removeItem("user_token");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_email");
    },
  },
});
