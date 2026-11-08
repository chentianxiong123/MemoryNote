"use client";

import { useEffect, useState } from "react";
import { trackPageView } from "@/modules/analytics";

// 设置页（抄 cognee settings/SettingsPage 概念：Profile + Security + 配置）
// 含 LLM API 配置（跟后端 LLM_API_BASE/KEY/MODEL 模板配套，未来接 API）
interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  dim: number;
}

export default function SettingsPage() {
  trackPageView("Settings");
  const [llm, setLlm] = useState<LlmConfig>({ baseUrl: "", apiKey: "", model: "", dim: 1536 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) setLlm(d.llm ?? llm);
    }).catch(() => {});
  }, []);

  const save = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ llm }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0D0F14] p-4 text-[#E9EEF6]">
      <h1 className="text-lg font-semibold">Settings</h1>
      <p className="mt-1 text-xs text-[#7E8CA6]">配置——LLM API（未来接入）</p>

      <div className="mt-4 max-w-[480px] space-y-4">
        <Section title="LLM API（embedding + 抽取）">
          <Field label="Base URL">
            <input value={llm.baseUrl} onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1" className={inputCls} />
          </Field>
          <Field label="API Key">
            <input value={llm.apiKey} onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
              placeholder="sk-…" type="password" className={inputCls} />
          </Field>
          <Field label="Embedding 模型">
            <input value={llm.model} onChange={(e) => setLlm({ ...llm, model: e.target.value })}
              placeholder="text-embedding-ada-002" className={inputCls} />
          </Field>
          <Field label="向量维度">
            <input value={llm.dim} onChange={(e) => setLlm({ ...llm, dim: Number(e.target.value) })}
              type="number" className={inputCls} />
          </Field>
          <button onClick={save} className="mt-2 rounded bg-[#43D9E8] px-4 py-2 text-xs font-semibold text-black">
            {saved ? "已保存 ✓" : "保存"}
          </button>
        </Section>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded border border-[#2A3142] bg-[#12151C] p-2 text-sm text-[#E9EEF6]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2A3142] bg-[#12151C] p-4">
      <div className="text-sm font-semibold text-[#43D9E8]">{title}</div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-[#7E8CA6]">{label}</div>
      {children}
    </div>
  );
}
