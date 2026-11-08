/**
 * graph_models 核心（抄 Cognee modules/graph_models/compiler.py + spec.py + merge.py）
 *
 * Cognee 支持自定义图 schema（GraphSchemaSpec）：定义实体类型 + 字段，
 * 编译成可用的图谱模型（graph_model_from_spec）。这里移植核心：
 *  - EntitySpec / RelationSpec / GraphSchemaSpec 类型
 *  - graph_spec_to_json_schema()：schema → JSON schema
 *  - merge spec：合并/upsert 实体定义（_upsert_fields/_upsert_entity）
 */

/** 字段类型（抄 cognee graph_models spec） */
export type FieldType =
  | "string" | "number" | "boolean" | "date"
  | "string[]" | "number[]"
  | "object" | "json";

/** 字段定义 */
export interface FieldSpec {
  name: string;
  type: FieldType;
  /** 是否身份字段（identity，实体唯一键） */
  identity?: boolean;
  /** 是否索引 */
  indexed?: boolean;
  required?: boolean;
  default?: unknown;
  description?: string;
}

/** 实体定义（EntitySpec） */
export interface EntitySpec {
  name: string;
  description?: string;
  fields: FieldSpec[];
}

/** 关系定义（RelationSpec） */
export interface RelationSpec {
  name: string;
  source: string;
  target: string;
  description?: string;
}

/** 图 schema（GraphSchemaSpec） */
export interface GraphSchemaSpec {
  entities: EntitySpec[];
  relations: RelationSpec[];
}

/** 内置默认 schema（抄 cognee 默认 ontology：Person/Organization/Concept/Event...） */
export const DEFAULT_GRAPH_SCHEMA: GraphSchemaSpec = {
  entities: [
    { name: "Person", fields: [{ name: "name", type: "string", identity: true }, { name: "description", type: "string" }] },
    { name: "Organization", fields: [{ name: "name", type: "string", identity: true }, { name: "description", type: "string" }] },
    { name: "Place", fields: [{ name: "name", type: "string", identity: true }, { name: "description", type: "string" }] },
    { name: "Concept", fields: [{ name: "name", type: "string", identity: true }, { name: "description", type: "string" }] },
    { name: "Event", fields: [{ name: "name", type: "string", identity: true }, { name: "description", type: "string" }] },
    { name: "Product", fields: [{ name: "name", type: "string", identity: true }, { name: "description", type: "string" }] },
    { name: "Technology", fields: [{ name: "name", type: "string", identity: true }, { name: "description", type: "string" }] },
    { name: "Document", fields: [{ name: "name", type: "string", identity: true }, { name: "description", type: "string" }] },
  ],
  relations: [],
};

/** schema → JSON schema（抄 graph_spec_to_json_schema） */
export function graphSchemaToJsonSchema(spec: GraphSchemaSpec): Record<string, unknown> {
  return {
    type: "object",
    properties: Object.fromEntries(
      spec.entities.map((e) => [
        e.name,
        {
          type: "object",
          properties: Object.fromEntries(
            e.fields.map((f) => [f.name, { type: jsonSchemaType(f.type), description: f.description }])
          ),
          required: e.fields.filter((f) => f.required).map((f) => f.name),
        },
      ])
    ),
  };
}

/** 字段类型 → JSON schema type */
function jsonSchemaType(t: FieldType): string {
  switch (t) {
    case "number": return "number";
    case "boolean": return "boolean";
    case "date": return "string";
    case "string[]": return "array";
    case "number[]": return "array";
    case "object": case "json": return "object";
    default: return "string";
  }
}

/** 合并/upsert 实体字段（抄 _upsert_fields：按 identity/name 去重合并） */
export function upsertFields(existing: FieldSpec[], incoming: FieldSpec[]): FieldSpec[] {
  const map = new Map(existing.map((f) => [f.name, f]));
  for (const f of incoming) map.set(f.name, f);
  return [...map.values()];
}

/** 合并 schema（抄 _upsert_entity + merge 核心） */
export function mergeSchema(base: GraphSchemaSpec, patch: GraphSchemaSpec): GraphSchemaSpec {
  const entityMap = new Map(base.entities.map((e) => [e.name, e]));
  for (const e of patch.entities) {
    const prev = entityMap.get(e.name);
    entityMap.set(e.name, prev ? { ...prev, fields: upsertFields(prev.fields, e.fields) } : e);
  }
  const relationMap = new Map(base.relations.map((r) => [`${r.source}->${r.target}:${r.name}`, r]));
  for (const r of patch.relations) relationMap.set(`${r.source}->${r.target}:${r.name}`, r);
  return { entities: [...entityMap.values()], relations: [...relationMap.values()] };
}

/** 校验 schema（抄 spec 校验：必填字段/合法类型） */
export function validateSchema(spec: GraphSchemaSpec): string[] {
  const errors: string[] = [];
  const validTypes: FieldType[] = ["string", "number", "boolean", "date", "string[]", "number[]", "object", "json"];
  for (const e of spec.entities) {
    if (!e.name) errors.push(`entity ${e.name}: 缺 name`);
    for (const f of e.fields) {
      if (!validTypes.includes(f.type)) errors.push(`entity ${e.name}.${f.name}: 非法类型 ${f.type}`);
    }
  }
  return errors;
}
