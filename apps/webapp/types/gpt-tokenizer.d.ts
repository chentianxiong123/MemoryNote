declare module 'gpt-tokenizer' {
  export function encode(text: string): number[];
  export function decode(tokens: number[]): string;
  export function encodeChat(messages: Array<{ role: string; content: string }>): number[];
  export function decodeChat(tokens: number[]): Array<{ role: string; content: string }>;
  export function isWithinTokenLimit(text: string, limit: number): boolean | number;
  export function countTokens(text: string): number;
}
