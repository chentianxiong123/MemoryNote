"use client";

import { useRef, useState } from "react";
import { useBusinessScene } from "@/modules/business/useBusinessScene";
import type { CogneeInstance } from "@/modules/instances/types";
import type { BrainState } from "@/modules/business/sceneTypes";
import { countLinksTouching } from "@/modules/business/computeBrainState";
import GraphCanvas from "@/modules/business/canvas/GraphCanvas";

// 简化图谱视图（抄 cognee BusinessView 核心：scene → canvas + 面板）
// 灵活抄：用 SVG 简化渲染实体节点/关系边（不追 canvas 548 行 draw/hitTest 细节）
export default function BusinessView({ cogniInstance }: { cogniInstance: CogneeInstance }) {
  const scene = useBusinessScene(cogniInstance, { graphPushActive: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const brain = scene.brainState;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#0D0F14] text-[12px] text-[#E9EEF6]">
      {/* 图谱 canvas（简化 SVG） */}
      <GraphCanvas brain={brain} onSelect={setSelectedId} />
      {/* 选中节点面板（抄 NodePanel 核心） */}
      {selectedId && brain?.entityById[selectedId] && (
        <NodePanel
          entity={brain.entityById[selectedId]}
          connectionCount={countLinksTouching(brain.graphLinks, selectedId)}
          docCount={countLinksTouching(brain.docLinks, selectedId)}
          onClose={() => setSelectedId(null)}
        />
      )}
      {/* 加载/空态 */}
      {scene.isLoading && <div className="absolute inset-0 flex items-center justify-center">加载图谱…</div>}
      {!scene.isLoading && !brain && (
        <div className="absolute inset-0 flex items-center justify-center text-[#7E8CA6]">
          图谱为空——先 cognify 一个数据集
        </div>
      )}
    </div>
  );
}



// 节点面板（抄 cognee NodePanel 核心）
function NodePanel({
  entity,
  connectionCount,
  docCount,
  onClose,
}: {
  entity: BrainState["entityById"][string];
  connectionCount: number;
  docCount: number;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-10 w-[260px] rounded-lg border border-[#2A3142] bg-[#12151C] p-3">
      <button onClick={onClose} className="float-right text-[#7E8CA6] hover:text-[#E9EEF6]">×</button>
      <div className="font-semibold text-[#43D9E8]">{entity.name}</div>
      <div className="mt-1 text-[11px] text-[#7E8CA6]">{String(entity.type)}</div>
      <div className="mt-2 space-y-1 text-[11px]">
        <div>连接 {connectionCount} · 文档 {docCount}</div>
        {!!entity.description && <div className="text-[#B8C2D9]">{String(entity.description)}</div>}
      </div>
    </div>
  );
}
