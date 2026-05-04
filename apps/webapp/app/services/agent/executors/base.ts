export type ConnectedIntegration = {
  id: string;
  type: string;
  name: string;
  config?: Record<string, unknown>;
};

export type GatewayAgentInfo = {
  id: string;
  name: string;
  type: string;
};

export interface SendChannelMessageParams {
  channelId: string;
  message: string;
  attachments?: Array<{ filename: string; content: string }>;
}

export interface SendChannelMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface OrchestratorToolsInterface {
  searchMemory(query: string, userId: string, workspaceId: string, source: string): Promise<string>;
  getSkill(skillId: string, workspaceId: string): Promise<string>;
  getIntegrations(workspaceId: string): Promise<ConnectedIntegration[]>;
  getIntegrationActions(integrationId: string): Promise<{ id: string; name: string }[]>;
  executeIntegrationAction(integrationId: string, actionId: string, params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }>;
}

export class OrchestratorTools implements OrchestratorToolsInterface {
  async searchMemory(query: string, userId: string, workspaceId: string, source: string): Promise<string> {
    return "not implemented";
  }

  async getSkill(skillId: string, workspaceId: string): Promise<string> {
    return "not implemented";
  }

  async getIntegrations(workspaceId: string): Promise<ConnectedIntegration[]> {
    return [];
  }

  async getIntegrationActions(integrationId: string): Promise<{ id: string; name: string }[]> {
    return [];
  }

  async executeIntegrationAction(integrationId: string, actionId: string, params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    return { success: false };
  }
}