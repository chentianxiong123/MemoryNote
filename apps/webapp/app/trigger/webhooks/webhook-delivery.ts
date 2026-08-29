import { task } from "@trigger.dev/sdk";

export const triggerWebhookDelivery = task({
  id: "webhook-delivery",
  run: async (payload: { webhookId: string; event: string; data: unknown }) => {
    return { success: true };
  },
});
