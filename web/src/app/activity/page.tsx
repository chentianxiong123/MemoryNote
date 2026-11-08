"use client";

import { useQuery } from "@tanstack/react-query";
import { trackPageView } from "@/modules/analytics";

// 活动流页（抄 cognee activity 页概念：per-event 工作区活动记录）
interface ActivityEvent {
  id: string;
  kind: "cognify" | "memify" | "ingest" | "search";
  detail: string;
  at: string;
}

export default function ActivityPage() {
  trackPageView("Activity");
  const events = useQuery({
    queryKey: ["activity"],
    queryFn: async (): Promise<ActivityEvent[]> => {
      const res = await fetch("/api/activity");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const icon = (k: ActivityEvent["kind"]) => ({
    cognify: "🧠", memify: "💾", ingest: "📥", search: "🔍",
  }[k] ?? "•");

  return (
    <div className="h-full overflow-y-auto bg-[#0D0F14] p-4 text-[#E9EEF6]">
      <h1 className="text-lg font-semibold">Activity</h1>
      <p className="mt-1 text-xs text-[#7E8CA6]">活动流——cognify/memify/ingest/search 事件</p>
      <div className="mt-4 space-y-2">
        {(events.data ?? []).map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded border border-[#2A3142] bg-[#12151C] p-2 text-xs">
            <span>{icon(e.kind)}</span>
            <span className="flex-1 text-[#B8C2D9]">{e.detail}</span>
            <span className="text-[#7E8CA6]">{new Date(e.at).toLocaleTimeString()}</span>
          </div>
        ))}
        {!events.isLoading && (events.data ?? []).length === 0 && (
          <div className="text-xs text-[#7E8CA6]">暂无活动</div>
        )}
      </div>
    </div>
  );
}
