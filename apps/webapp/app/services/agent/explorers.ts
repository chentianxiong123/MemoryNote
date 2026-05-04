export interface ExplorerResult {
  id: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function searchMemory(query: string, options?: {
  workspaceId?: string;
  userId?: string;
  limit?: number;
}): Promise<ExplorerResult[]> {
  return [];
}

export async function getSkill(skillId: string): Promise<{
  id: string;
  name: string;
  description: string;
} | null> {
  return null;
}

export async function getIntegrations(workspaceId: string): Promise<{
  id: string;
  name: string;
  type: string;
}[]> {
  return [];
}

export async function getIntegrationActions(integrationId: string): Promise<{
  id: string;
  name: string;
  description: string;
}[]> {
  return [];
}

export async function executeIntegrationAction(
  integrationId: string,
  actionId: string,
  params: Record<string, unknown>,
): Promise<{ success: boolean; result?: unknown }> {
  return { success: false };
}

export async function runWebExplorer(
  query: string,
  options?: {
    workspaceId?: string;
    userId?: string;
  },
): Promise<ExplorerResult[]> {
  return [];
}
