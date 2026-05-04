export interface DecisionAgentInput {
  userMessage: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  context?: Record<string, unknown>;
}

export interface DecisionAgentOutput {
  action: "respond" | "clarify" | "delegate" | "reject";
  reasoning: string;
  response?: string;
  delegateTo?: string;
}

export type Trigger = {
  type: string;
  data?: Record<string, unknown>;
};

export interface DecisionContext {
  trigger?: Trigger;
  userId?: string;
  workspaceId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}
