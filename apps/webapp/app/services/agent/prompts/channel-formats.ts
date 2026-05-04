export type ChannelType =
  | "email"
  | "slack"
  | "discord"
  | "web"
  | "whatsapp"
  | "telegram"
  | "api"
  | "core";

export const CHANNEL_FORMATS: Record<ChannelType, { format: string; example: string }> = {
  email: {
    format: "Subject: {subject}\n\n{body}",
    example: "Subject: Meeting Tomorrow\n\nHi, let's meet tomorrow at 2pm.",
  },
  slack: {
    format: "**{title}**\n{message}",
    example: "**New Update**\nHere's the latest update on the project.",
  },
  discord: {
    format: "**{title}**\n{message}",
    example: "**New Update**\nHere's the latest update on the project.",
  },
  web: {
    format: "{message}",
    example: "Here's the message content.",
  },
  whatsapp: {
    format: "{message}",
    example: "Here's the message content.",
  },
  telegram: {
    format: "{message}",
    example: "Here's the message content.",
  },
  api: {
    format: "{message}",
    example: "Here's the message content.",
  },
  core: {
    format: "{message}",
    example: "Here's the message content.",
  },
};
