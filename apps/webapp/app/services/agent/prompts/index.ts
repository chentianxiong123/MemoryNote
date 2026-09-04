/**
 * Prompt Builder
 *
 * Two-layer architecture:
 * - Core brain: personality + response format (synthesis only)
 * - Orchestrator: no personality, gathers context
 */

import { PERSONALITY, type PersonalityType, type PronounType } from "./personality";
import { CAPABILITIES } from "./capabilities";
import { buildDecisionAgentPrompt } from "./decision-prompt";

export interface UserInfo {
  name: string;
  email: string;
  timezone: string;
  phoneNumber?: string;
  personality?: string;
  pronoun?: PronounType;
  customPersonality?: { text: string; useHonorifics: boolean };
}

/**
 * Get Core brain's prompt for synthesizing responses.
 * Combines personality (who Core brain is) + capabilities (what Core brain can do) + response format.
 */
export function getCorePrompt(
  _channel?: string,
  userInfo?: UserInfo,
  userPersona?: string,
  butlerName?: string,
): string {
  const responseFormat = "{message}";
  const timezone = userInfo?.timezone || "UTC";
  const localTime = new Date().toLocaleString("en-US", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  });
  const currentTime = `Current time: ${localTime} (${timezone})`;

  let userContext = "";
  if (userInfo) {
    userContext = `\n\n<user>
Name: ${userInfo.name}
Email: ${userInfo.email}
Timezone: ${userInfo.timezone}${userInfo.phoneNumber ? `\nPhone: ${userInfo.phoneNumber}` : ""}
</user>`;
  }

  let personaSection = "";
  if (userPersona) {
    personaSection = `\n\n<user-persona>
${userPersona}
</user-persona>`;
  }

  const personalityType = (userInfo?.personality as PersonalityType) || "tars";
  const personalityPrompt =
    PERSONALITY[personalityType] ?? PERSONALITY.friendly;

  return `${personalityPrompt}\n\n${CAPABILITIES}\n\n${responseFormat}\n\n${currentTime}${userContext}${personaSection}`;
}

// Re-export for convenience
export { PERSONALITY, PERSONALITY_OPTIONS } from "./personality";
export type { PersonalityType, PronounType } from "./personality";
export { CAPABILITIES } from "./capabilities";
export { buildDecisionAgentPrompt };
