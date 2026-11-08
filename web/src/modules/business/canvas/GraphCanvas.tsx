"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrainState } from "../sceneTypes";
import { colorForSet } from "../computeBrainState";

// 自包含 canvas 图谱渲染器（灵活抄 cognee BusinessCanvas 交互概念）
// drag/zoom/hover + 渲染循环 + 实体/边绘制。不追上游 548 行全依赖链。
export interface GraphCanvasHandle {
  fit: () => void;
  centerOn: (id: string) => void;
}

export default function GraphCanvas({
  brain,
  onSelect,
  onHover,
}: {
  brain: BrainState | null;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const transform = useRef({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  // 布局（确定性网格，缓存）
  const layout = useMemo(() => {
    if (!brain) return null;
    const entities = brain.entities.slice(0, 200);
    const W = 1400, H = 800, cols = Math.ceil(Math.sqrt(entities.length));
    const pos = new Map<string, { x: number; y: number }>();
    entities.forEach((e, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      pos.set(e.id, {
        x: 100 + c * ((W - 200) / Math.max(cols - 1, 1)),
        y: 80 + r * ((H - 160) / Math.max(Math.ceil(entities.length / cols) - 1, 1)),
      });
    });
    return { pos, entities };
  }, [brain]);

  // 尺寸观察
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 渲染循环（requestAnimationFrame）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const render = () => {
      const { x, y, k } = transform.current;
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      // 边
      if (layout && brain) {
        ctx.strokeStyle = "#3A4358";
        ctx.lineWidth = 0.8 / k;
        ctx.globalAlpha = 0.7;
        for (const l of brain.semanticLinks.slice(0, 400)) {
          const s = layout.pos.get(l._sid), t = layout.pos.get(l._tid);
          if (!s || !t) continue;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
        // 节点
        for (const e of layout.entities) {
          const p = layout.pos.get(e.id);
          if (!p) continue;
          const typeName = brain.entityType[e.id] ?? "other";
          const color = colorForSet(typeName, 0);
          const r = (e.importance && e.importance > 2 ? 9 : 6) / k;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(r, 3), 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = hovered === e.id ? 1 : 0.85;
          ctx.fill();
          if (hovered === e.id) {
            ctx.strokeStyle = "#43D9E8";
            ctx.lineWidth = 1.5 / k;
            ctx.stroke();
          }
          // 标签
          if (k > 0.6) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#B8C2D9";
            ctx.font = `${9 / k}px sans-serif`;
            ctx.textAlign = "center";
            ctx.fillText((e.name ?? "").slice(0, 16), p.x, p.y - 12 / k);
          }
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [layout, brain, size, hovered]);

  // 命中测试（世界坐标→实体）
  const hitTest = useCallback((clientX: number, clientY: number): string | null => {
    if (!layout || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const wx = (clientX - rect.left - transform.current.x) / transform.current.k;
    const wy = (clientY - rect.top - transform.current.y) / transform.current.k;
    for (const e of layout.entities) {
      const p = layout.pos.get(e.id);
      if (!p) continue;
      const r = Math.max((e.importance && e.importance > 2 ? 9 : 6) / transform.current.k, 4);
      if (Math.hypot(wx - p.x, wy - p.y) <= r + 4) return e.id;
    }
    return null;
  }, [layout]);

  // 交互（pointer events：drag 平移 / wheel 缩放 / hover）
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, active: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current.active) {
      transform.current.x += e.clientX - drag.current.x;
      transform.current.y += e.clientY - drag.current.y;
      drag.current = { x: e.clientX, y: e.clientY, active: true };
    } else {
      const id = hitTest(e.clientX, e.clientY);
      setHovered(id);
      onHover?.(id);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current.active = false;
    const id = hitTest(e.clientX, e.clientY);
    if (id) onSelect?.(id);
  };
  const onWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    transform.current.k = Math.min(5, Math.max(0.2, transform.current.k * factor));
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} width={size.w} height={size.h}
        className="h-full w-full cursor-grab"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onWheel={onWheel}
        onPointerLeave={() => { setHovered(null); onHover?.(null); }} />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/40 px-2 py-1 text-[10px] text-[#7E8CA6]">
        拖拽平移 · 滚轮缩放 · 点击选中
      </div>
    </div>
  );
}
