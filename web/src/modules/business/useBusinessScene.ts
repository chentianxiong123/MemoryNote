"use client";

import { useMemo, useState } from "react";
import type { CogneeInstance } from "@/modules/instances/types";
import contentLayer from "./layers/contentLayer";
import type { BusinessLayerContext } from "./layers/types";
import type { VisualizationPayload } from "./types";
import { computeBrainState } from "./computeBrainState";
import type { BrainState } from "./sceneTypes";

export interface BusinessScene {
  brainState: BrainState | null;
  isLoading: boolean;
  isContentLoading: boolean;
  contentError: unknown;
  layerData: Record<string, VisualizationPayload | null>;
  activeDatasetId: string | null;
  setActiveDatasetId: (id: string | null) => void;
}

export interface BusinessSceneOptions {
  graphPushActive: boolean;
}

// 合并 layers → computeBrainState（抄 cognee useBusinessScene 核心）
export function useBusinessScene(
  cogniInstance: CogneeInstance,
  { graphPushActive }: BusinessSceneOptions,
): BusinessScene {
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const ctx: BusinessLayerContext = { cogniInstance, activeDatasetId, graphPushActive };

  const content = contentLayer.useData(ctx);

  const layerData = useMemo(
    () => ({ [contentLayer.id]: content.data }),
    [content.data],
  );

  const brainState = useMemo(() => {
    const payloads = Object.values(layerData).filter((d): d is VisualizationPayload => d !== null);
    if (!payloads.length) return null;
    return computeBrainState(payloads.flatMap((p) => p.nodes), payloads.flatMap((p) => p.links));
  }, [layerData]);

  return {
    brainState,
    isLoading: content.isLoading,
    isContentLoading: content.isLoading,
    contentError: content.error,
    layerData,
    activeDatasetId,
    setActiveDatasetId,
  };
}
