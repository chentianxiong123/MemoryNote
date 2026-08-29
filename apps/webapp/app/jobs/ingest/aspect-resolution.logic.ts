/**
 * Aspect resolution stub - disabled.
 * Voice aspects are not a core feature of the personal knowledge base.
 */

export async function processAspectResolution(
  _payload: {
    episodeUuid: string;
    userId: string;
    workspaceId: string;
  },
): Promise<{ success: boolean }> {
  return { success: false };
}
