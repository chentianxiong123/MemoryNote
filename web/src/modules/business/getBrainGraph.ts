import type { CogneeInstance } from "@/modules/instances/types";
import type { VisualizationPayload } from "./types";
import { hasRowDetail, isStructuredRow } from "./structuredRow";

// 简化版图谱 API（抄 cognee getBrainGraph 核心：fetch /v1/visualize/json）
// 灵活：自建知识库用 GET {apiBase}/api/graph?dataset={id}
export default async function getBrainGraph(
  cogniInstance: CogneeInstance,
  datasetId: string | null,
): Promise<VisualizationPayload> {
  const base = cogniInstance.apiBase ?? "";
  const params = new URLSearchParams();
  if (datasetId) params.set("dataset", datasetId);
  const res = await fetch(`${base}/api/graph?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`图谱加载失败: ${res.status}`);
  }
  const payload = (await res.json()) as VisualizationPayload;
  // 归一化（抄 readGraphStream/结构化节点处理）
  return {
    nodes: (payload.nodes ?? []).map((n) => (isStructuredRow(n) && hasRowDetail(n) ? n : n)),
    links: payload.links ?? [],
    color_maps: payload.color_maps ?? { node_set: {} },
  };
}
