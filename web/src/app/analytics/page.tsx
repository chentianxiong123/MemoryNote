"use client";

import { useQuery } from "@tanstack/react-query";
import { trackPageView } from "@/modules/analytics";

// 用量统计页（抄 cognee analytics 页概念：展示 tenant 用量/统计）
// 开源 stub——用量从 API 读（/api/stats），不接云端
interface Stats {
  entities: number;
  relations: number;
  memories: number;
  runs: number;
  datasets: number;
}

export default function AnalyticsPage({ apiBase = "" }: { apiBase?: string }) {
  trackPageView("Analytics");
  const stats = useQuery({
    queryKey: ["stats", apiBase],
    queryFn: async (): Promise<Stats> => {
      const res = await fetch(`${apiBase}/api/stats`);
      if (!res.ok) return { entities: 0, relations: 0, memories: 0, runs: 0, datasets: 0 };
      return res.json();
    },
  });

  const s = stats.data ?? { entities: 0, relations: 0, memories: 0, runs: 0, datasets: 0 };
  const cards = [
    { label: "图谱实体", value: s.entities, color: "#43D9E8" },
    { label: "图谱关系", value: s.relations, color: "#F5A83C" },
    { label: "记忆条目", value: s.memories, color: "#8A7BD8" },
    { label: "Pipeline 运行", value: s.runs, color: "#5B6880" },
    { label: "数据集", value: s.datasets, color: "#7E8CA6" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#0D0F14] p-4 text-[#E9EEF6]">
      <h1 className="text-lg font-semibold">Analytics</h1>
      <p className="mt-1 text-xs text-[#7E8CA6]">用量统计——图谱/记忆/pipeline 运行</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-[#2A3142] bg-[#12151C] p-4">
            <div className="text-xs text-[#7E8CA6]">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold" style={{ color: c.color }}>
              {stats.isLoading ? "…" : c.value}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-[#7E8CA6]">开源版本——统计从 /api/stats 读取；用量历史（token/花费）属云端功能。</p>
    </div>
  );
}
