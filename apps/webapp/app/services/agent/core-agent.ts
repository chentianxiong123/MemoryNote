/**
 * Re-export from new location.
 * @deprecated Import from ~/services/agent/agents/core instead.
 */

import { type Tool } from "ai";
import { createCoreTools } from "./agents/core";

export const createTools = async (
  userId: string,
  workspaceId: string,
  timezone: string,
  source: string,
  readOnly: boolean = false,
  _persona?: string,
  onMessage?: (message: string) => Promise<void>,
  defaultChannel?: string,
  availableChannels?: string[],
  _conversationId?: string,
  _channelMetadata?: Record<string, unknown>,
  _executorTools?: unknown,
  _triggerContext?: unknown,
  isBackgroundExecution?: boolean,
): Promise<Record<string, Tool>> => {
  return createCoreTools({
    userId,
    workspaceId,
    timezone,
    source,
    conversationId: _conversationId ?? "",
    interactive: !isBackgroundExecution,
  });
};
