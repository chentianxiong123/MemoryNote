import { type ChannelType } from "./channel-formats";

export function buildDecisionAgentPrompt(context: {
  userMessage: string;
  channelType?: ChannelType;
  previousContext?: string;
}): string {
  return `You are a decision-making agent. Analyze the following message and decide the best action.

User Message: ${context.userMessage}
Channel: ${context.channelType || "web"}
Previous Context: ${context.previousContext || "None"}

Provide your decision in JSON format.`;
}
