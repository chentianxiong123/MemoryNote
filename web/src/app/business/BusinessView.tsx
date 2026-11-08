"use client";

import { useMemo, useRef, useState } from "react";
import { useBusinessScene } from "@/modules/business/useBusinessScene";
import type { CogneeInstance } from "@/modules/instances/types";
import type { BrainState } from "@/modules/business/sceneTypes";
import { countLinksTouching } from "@/modules/business/computeBrainState";
import { colorForSet } from "@/modules/business/computeBrainState";

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

// 简化 SVG 图谱（抄 cognee businessDraw 的核心：画实体 + 语义边）
function GraphCanvas({
  brain,
  onSelect,
}: {
  brain: BrainState | null;
  onSelect: (id: string | null) => void;
}) {
  const layout = useMemo(() => {
    if (!brain) return null;
    // 简单网格布局（不追 d3-force-3d，先用确定性布局——灵活抄）
    const entities = brain.entities.slice(0, 120);
    const W = 1200, H = 700, cols = Math.ceil(Math.sqrt(entities.length));
    const pos = new Map<string, { x: number; y: number }>();
    entities.forEach((e, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      pos.set(e.id, { x: 80 + c * ((W - 160) / Math.max(cols - 1, 1)), y: 60 + r * ((H - 120) / Math.max(Math.ceil(entities.length / cols) - 1, 1)) });
    });
    return { pos, entities };
  }, [brain]);

  if (!layout) return null;
  const { pos, entities } = layout;
  const links = brain?.semanticLinks ?? [];

  return (
    <svg className="h-full w-full" viewBox="0 0 1200 700">
      {/* 关系边 */}
      {links.slice(0, 300).map((l, i) => {
        const s = pos.get(l._sid), t = pos.get(l._tid);
        if (!s || !t) return null;
        return (
          <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke="#3A4358" strokeWidth={0.8} opacity={0.7} />
        );
      })}
      {/* 实体节点 */}
      {entities.map((e) => {
        const p = pos.get(e.id);
        if (!p) return null;
        const typeName = brain?.entityType[e.id] ?? "other";
        const color = colorForSet(typeName, 0);
        return (
          <g key={e.id} transform={`translate(${p.x},${p.y})`}
            className="cursor-pointer"
            onClick={() => onSelect(e.id)}>
            <circle r={e.importance && e.importance > 2 ? 10 : 6} fill={color} opacity={0.85} />
            <text y={-12} textAnchor="middle" fill="#B8C2D9" fontSize={9}>
              {e.name?.slice(0, 16)}
            </text>
          </g>
        );
      })}
    </svg>
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
