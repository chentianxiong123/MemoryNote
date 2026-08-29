/**
 * Aspect store stub - voice aspect embeddings disabled.
 */

export async function saveVoiceAspects(
  _userId: string,
  _workspaceId: string,
  _aspects: unknown[],
): Promise<void> {
  // No-op
}

export async function deleteVoiceAspectEmbeddings(
  _userId: string,
  _workspaceId: string,
  _entityUuid: string,
): Promise<void> {
  // No-op
}

export async function searchVoiceAspects(
  _params: {
    userId: string;
    workspaceId: string;
    query: string;
  },
): Promise<unknown[]> {
  return [];
}

export async function getVoiceAspectsForTimeRange(
  _params: {
    userId: string;
    workspaceId: string;
    startTime: Date;
    endTime: Date;
    aspects: string[];
  },
): Promise<unknown[]> {
  return [];
}
