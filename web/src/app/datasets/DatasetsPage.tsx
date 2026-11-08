"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

// 数据集导入页（抄 cognee datasets/DatasetsPage 核心 + ingestion 模块）
// 灵活：简化渲染（列表 + 创建 + 粘贴文本导入 + 上传），跟后端 ingest 配套

export interface Dataset {
  id: string;
  name: string;
  status: "empty" | "processing" | "ready";
  node_count: number;
}

export function useDatasets(apiBase: string) {
  return useQuery({
    queryKey: ["datasets", apiBase],
    queryFn: async (): Promise<Dataset[]> => {
      const res = await fetch(`${apiBase}/api/datasets`);
      if (!res.ok) throw new Error(`数据集加载失败: ${res.status}`);
      return (await res.json()) as Dataset[];
    },
  });
}

/** 导入文本（抄 ingestion/addData：POST /api/ingest，跟后端 ingest 工具配套） */
export async function ingestText(apiBase: string, dataset: string, text: string) {
  const res = await fetch(`${apiBase}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dataset, data: text, type: "text" }),
  });
  if (!res.ok) throw new Error(`导入失败: ${res.status}`);
  return res.json();
}

/** 上传文件（抄 ingestion/addFiles：multipart → /api/ingest） */
export async function ingestFiles(apiBase: string, dataset: string, files: File[]) {
  const fd = new FormData();
  fd.set("dataset", dataset);
  files.forEach((f) => fd.append("files", f));
  const res = await fetch(`${apiBase}/api/ingest`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`上传失败: ${res.status}`);
  return res.json();
}

export default function DatasetsPage({ apiBase }: { apiBase: string }) {
  const datasets = useDatasets(apiBase);
  const [showCreate, setShowCreate] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(() => datasets.data ?? [], [datasets.data]);

  return (
    <div className="flex h-full w-full flex-col bg-[#0D0F14] text-[#E9EEF6]">
      <div className="flex items-center justify-between border-b border-[#2A3142] p-4">
        <div>
          <h1 className="text-lg font-semibold">Datasets</h1>
          <p className="text-xs text-[#7E8CA6]">数据摄入——导入文档/文本 → 知识图谱</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPaste(true)}
            className="rounded border border-[#2A3142] px-3 py-1.5 text-xs hover:bg-[#12151C]">Paste text</button>
          <button onClick={() => setShowCreate(true)}
            className="rounded bg-[#43D9E8] px-3 py-1.5 text-xs text-black hover:opacity-90">Create dataset</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {datasets.isLoading && <div className="text-[#7E8CA6]">加载数据集…</div>}
        {!datasets.isLoading && list.length === 0 && (
          <div className="text-[#7E8CA6]">还没有数据集——点 Create dataset 创建</div>
        )}
        {list.map((d) => (
          <div key={d.id}
            className={`mb-2 flex cursor-pointer items-center justify-between rounded border p-3 hover:bg-[#12151C] ${selectedId === d.id ? "border-[#43D9E8]" : "border-[#2A3142]"}`}
            onClick={() => setSelectedId(d.id)}>
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-[11px] text-[#7E8CA6]">{d.status} · {d.node_count} 节点</div>
            </div>
            <span className="text-[#43D9E8]">→</span>
          </div>
        ))}
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} apiBase={apiBase} />
      )}
      {showPaste && (
        <PasteModal onClose={() => setShowPaste(false)} apiBase={apiBase} datasets={list} />
      )}
    </div>
  );
}

// 创建数据集弹窗（抄 CreateBrainModal 核心）
function CreateModal({ onClose, apiBase }: { onClose: () => void; apiBase: string }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const create = async () => {
    setCreating(true);
    await fetch(`${apiBase}/api/datasets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50">
      <div className="w-[360px] rounded-lg border border-[#2A3142] bg-[#12151C] p-4">
        <h2 className="text-base font-semibold">Create dataset</h2>
        <p className="mt-1 text-xs text-[#7E8CA6]">给数据集命名，创建后上传文档</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="数据集名"
          className="mt-3 w-full rounded border border-[#2A3142] bg-[#0D0F14] p-2 text-sm" />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-xs text-[#7E8CA6] hover:bg-[#0D0F14]">取消</button>
          <button onClick={create} disabled={!name || creating}
            className="rounded bg-[#43D9E8] px-3 py-1.5 text-xs text-black disabled:opacity-50">
            {creating ? "创建中…" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 粘贴文本导入弹窗（抄 PasteTextModal 核心）
function PasteModal({ onClose, apiBase, datasets }: { onClose: () => void; apiBase: string; datasets: Dataset[] }) {
  const [text, setText] = useState("");
  const [dataset, setDataset] = useState(datasets[0]?.id ?? "");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async () => {
    if (!dataset || !text) return;
    setImporting(true);
    await ingestText(apiBase, dataset, text);
    setImporting(false);
    setDone(true);
  };
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50">
      <div className="w-[420px] rounded-lg border border-[#2A3142] bg-[#12151C] p-4">
        <h2 className="text-base font-semibold">Paste text</h2>
        <p className="mt-1 text-xs text-[#7E8CA6]">粘贴文本，作为文档加入数据集 → 知识图谱</p>
        <select value={dataset} onChange={(e) => setDataset(e.target.value)}
          className="mt-3 w-full rounded border border-[#2A3142] bg-[#0D0F14] p-2 text-sm">
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Paste your text here…"
          className="mt-2 w-full rounded border border-[#2A3142] bg-[#0D0F14] p-2 text-sm" />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-xs text-[#7E8CA6] hover:bg-[#0D0F14]">取消</button>
          <button onClick={submit} disabled={!dataset || !text || importing}
            className="rounded bg-[#43D9E8] px-3 py-1.5 text-xs text-black disabled:opacity-50">
            {importing ? "导入中…" : done ? "已导入 ✓" : "导入"}
          </button>
        </div>
      </div>
    </div>
  );
}
