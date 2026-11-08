// 版本记录（抄 cognee modules/releases/releaseLog.ts 核心）

export interface Release {
  version: string;
  releasedAt: string | null;
  summary: string;
  highlights: string[];
  fixes: string[];
}

export interface ReleaseLog {
  versions: Release[];
}

export function displayVersion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/\d+/);
  return match ? `v${match[0]}` : null;
}

export function formatReleaseDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function latestWithNotes(releases: Release[]): Release | null {
  return releases.find((r) => r.highlights.length > 0 || r.fixes.length > 0) ?? null;
}

export function whatsNewLines(release: Release, max = 3): string[] {
  return [...release.highlights, ...release.fixes].slice(0, max);
}
