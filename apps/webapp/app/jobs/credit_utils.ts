/**
 * Credit utilities - Stub implementation
 * Original billing system removed, replaced with no-op stubs.
 */

export function estimateCreditsFromTokens(tokens: number): number {
  return Math.ceil(tokens / 1000);
}

export async function reserveCredits(
  workspaceId: string,
  userId: string,
  credits: number,
): Promise<number> {
  return credits;
}

export async function hasCredits(userId: string): Promise<boolean> {
  return true;
}

export async function consumeCredits(
  userId: string,
  credits: number,
): Promise<{ success: boolean }> {
  return { success: true };
}

export async function refundCredits(
  workspaceId: string,
  userId: string,
  reservationId: string,
): Promise<{ success: boolean }> {
  return { success: true };
}

export async function deductCredits(
  userId: string,
  credits: number,
): Promise<{ success: boolean }> {
  return { success: true };
}

export async function reconcileCredits(
  workspaceId: string,
  userId: string,
  reservationId: string,
): Promise<{ success: boolean }> {
  return { success: true };
}
