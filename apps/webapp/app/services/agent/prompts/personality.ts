export type PersonalityType = "professional" | "friendly" | "casual";
export type PronounType = "they" | "she" | "he";

export const PERSONALITY: Record<PersonalityType, string> = {
  professional: "You are a professional and helpful assistant.",
  friendly: "You are a friendly and approachable assistant.",
  casual: "You are a casual and relaxed assistant.",
};

export const PERSONALITY_OPTIONS: { value: PersonalityType; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
];
