export type ChannelType = "web";

export const CHANNEL_FORMATS: Record<ChannelType, { format: string; example: string }> = {
  web: {
    format: "{message}",
    example: "Here's the message content.",
  },
};
