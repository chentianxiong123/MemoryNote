"use client";

import { useReducer, useState } from "react";
import { schemaReducer, emptySchema } from "@/modules/graphModels/schemaReducer";
import type { GraphSchema } from "@/modules/graphModels/types";

// 图模型编辑器（抄 cognee GraphModelEditorPage 核心，灵活简化）
// 用 schemaReducer（源码级抄）管理实体/字段状态，跟后端 graph/schema.ts 配套
export default function GraphModelEditorPage({ modelId }: { modelId: string }) {
  const [schema, dispatch] = useReducer(schemaReducer, emptySchema());
  const [entityName, setEntityName] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<"string" | "number" | "boolean">("string");

  const addEntity = () => {
    if (!entityName) return;
    dispatch({ type: "ADD_ENTITY", name: entityName });
    setEntityName("");
  };
  const addField = (entityId: string) => {
    if (!fieldName) return;
    dispatch({ type: "ADD_FIELD", entityId, field: { name: fieldName, kind: "primitive", primitiveType: fieldType } });
    setFieldName("");
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#0D0F14] p-4 text-[#E9EEF6]">
      <h1 className="text-lg font-semibold">Graph model <span className="text-[#7E8CA6]">({modelId})</span></h1>
      <p className="mt-1 text-xs text-[#7E8CA6]">图模型编辑器——定义实体/字段/关系（抄 cognee graph-models）</p>

      <div className="mt-4 flex gap-2">
        <input value={entityName} onChange={(e) => setEntityName(e.target.value)} placeholder="实体名（如 Person）"
          className="rounded border border-[#2A3142] bg-[#12151C] p-2 text-sm" />
        <button onClick={addEntity} className="rounded bg-[#43D9E8] px-3 py-2 text-xs text-black">Add entity</button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {schema.entities.map((e) => (
          <div key={e.name} className="rounded border border-[#2A3142] bg-[#12151C] p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#43D9E8]">{e.name}</span>
              <button onClick={() => dispatch({ type: "DELETE_ENTITY", entityId: e._id })}
                className="text-xs text-[#7E8CA6] hover:text-red-400">删除</button>
            </div>
            <div className="mt-2 flex gap-1">
              <input value={fieldName} onChange={(ev) => setFieldName(ev.target.value)} placeholder="字段名"
                className="flex-1 rounded border border-[#2A3142] bg-[#0D0F14] p-1 text-xs" />
              <select value={fieldType} onChange={(ev) => setFieldType(ev.target.value as typeof fieldType)}
                className="rounded border border-[#2A3142] bg-[#0D0F14] p-1 text-xs">
                <option>string</option><option>number</option><option>boolean</option>
              </select>
              <button onClick={() => addField(e._id)} className="rounded bg-[#2A3142] px-2 text-xs">+</button>
            </div>
            <div className="mt-2 space-y-1">
              {e.fields.map((f) => (
                <div key={f._id} className="flex justify-between text-xs text-[#B8C2D9]">
                  <span>{f.name}</span><span className="text-[#7E8CA6]">{f.kind === "primitive" ? f.primitiveType : f.kind}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <pre className="mt-4 rounded bg-[#12151C] p-3 text-xs text-[#7E8CA6]">{JSON.stringify(schema, null, 2)}</pre>
    </div>
  );
}
