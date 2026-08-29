import { task } from "@trigger.dev/sdk";

export const personaGenerationTask = task({
  id: "persona-generation",
  run: async (payload: { workspaceId: string }) => {
    return { success: true };
  },
});
