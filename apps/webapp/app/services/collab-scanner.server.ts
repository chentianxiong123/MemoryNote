export function scanDocument(content: string): { sensitive: boolean; patterns: string[] } {
  return { sensitive: false, patterns: [] };
}

export async function handleScratchpadStore(
  documentId: string,
  content: unknown,
): Promise<void> {}

export async function cleanupPage(pageId: string): Promise<void> {}
