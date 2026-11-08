"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { CogneeInstance } from "@/modules/instances/types";
import getBrainGraph from "./getBrainGraph";
import type { VisualizationPayload } from "./types";

export function brainGraphQueryKey(instanceId: string, datasetId: string | null): readonly [string, string, string | null] {
  return ["brain-graph", instanceId, datasetId] as const;
}

// 图谱数据 hook（抄 cognee useBrainGraph，灵活：简化去 circuitBreaker/poll 细节）
export function useBrainGraph(
  cogniInstance: CogneeInstance,
  activeDatasetId: string | null,
  graphPushActive: boolean,
): UseQueryResult<VisualizationPayload> {
  void graphPushActive; // 简化：先不做实时推流
  return useQuery({
    queryKey: brainGraphQueryKey(cogniInstance.id, activeDatasetId),
    queryFn: () => getBrainGraph(cogniInstance, activeDatasetId),
    enabled: activeDatasetId !== null,
    refetchInterval: false,
  });
}
