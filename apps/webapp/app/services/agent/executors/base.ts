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
  searchMemory(query: string, userId: string, source: string): Promise<string>;

}

export class OrchestratorTools implements OrchestratorToolsInterface {
  async searchMemory(query: string, userId: string, source: string): Promise<string> {
    return "not implemented";
  }
}