import { CHANNEL_FORMATS } from "~/services/agent/prompts/channel-formats";

export function getChannel(
  channelType: string,
): { type: string; format: string } | null {
  const channelFormat =
    CHANNEL_FORMATS[channelType as keyof typeof CHANNEL_FORMATS];

  return {
    type: channelType,
    format: channelFormat?.format ?? CHANNEL_FORMATS.web.format,
  };
}
