import { task } from "@trigger.dev/sdk";

export const labelAssignmentTask = task({
  id: "label-assignment",
  run: async (payload: { documentId: string; content: string }) => {
    return { success: true };
  },
});
