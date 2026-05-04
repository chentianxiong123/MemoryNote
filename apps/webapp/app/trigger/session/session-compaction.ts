import { task } from "@trigger.dev/sdk";

export const sessionCompactionTask = task({
  id: "session-compaction",
  run: async (payload: { sessionId: string }) => {
    return { success: true };
  },
});
