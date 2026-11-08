"use client";

import { useQuery } from "@tanstack/react-query";
import { displayVersion, formatReleaseDate, type Release } from "@/modules/releases/releaseLog";
import { trackPageView } from "@/modules/analytics";

// 版本记录页（抄 cognee releases/ReleasesPage 核心，灵活简化）
export default function ReleasesPage() {
  trackPageView("Releases");
  const releases = useQuery({
    queryKey: ["releases"],
    queryFn: async (): Promise<Release[]> => {
      const res = await fetch("/api/releases");
      if (!res.ok) return [];
      return (await res.json()).versions ?? [];
    },
  });

  return (
    <div className="h-full overflow-y-auto bg-[#0D0F14] p-4 text-[#E9EEF6]">
      <h1 className="text-lg font-semibold">Releases</h1>
      <p className="mt-1 text-xs text-[#7E8CA6]">版本记录</p>
      <div className="mt-4 space-y-3">
        {(releases.data ?? []).map((r) => (
          <div key={r.version} className="rounded-lg border border-[#2A3142] bg-[#12151C] p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#43D9E8]">{displayVersion(r.version)}</span>
              <span className="text-[11px] text-[#7E8CA6]">{formatReleaseDate(r.releasedAt)}</span>
            </div>
            {r.summary && <p className="mt-1 text-xs text-[#B8C2D9]">{r.summary}</p>}
            {r.highlights.length > 0 && (
              <div className="mt-2"><div className="text-[11px] text-[#F5A83C]">Highlights</div>
                <ul className="ml-4 list-disc text-xs text-[#B8C2D9]">{r.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul></div>
            )}
            {r.fixes.length > 0 && (
              <div className="mt-2"><div className="text-[11px] text-[#7E8CA6]">Fixes</div>
                <ul className="ml-4 list-disc text-xs text-[#B8C2D9]">{r.fixes.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
            )}
          </div>
        ))}
        {!releases.isLoading && (releases.data ?? []).length === 0 && (
          <div className="text-xs text-[#7E8CA6]">暂无版本记录</div>
        )}
      </div>
    </div>
  );
}
