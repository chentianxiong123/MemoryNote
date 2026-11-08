/**
 * agent_memory 模块（抄 Cognee modules/agent_memory）
 *
 * 上游：agent_memory() 装饰器给 async agent 函数加记忆上下文
 * （retrieve memory context → 调 agent → persist trace），
 * 配 sanitization（清洗运行时值）。这里抄核心：
 *   - sanitizeValue / truncateText（抄 sanitization.py）
 *   - AgentMemoryConfig（抄 runtime.py 配置）
 *   - agentMemory() 装饰器（抄 decorator.py）
 */

/** 清洗核心（抄 sanitization.py） */
export const MAX_SERIALIZED_VALUE_LENGTH = 1000;
export const MAX_TRACE_CONTAINER_ITEMS = 20;

export function truncateText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return value.slice(0, limit - 3) + "...";
}

function keyName(key: unknown): string {
  if (typeof key === "string") return key;
  if (typeof key === "object" && key !== null && "id" in key) {
    return `${(key as { id: unknown }).id}`;
  }
  return truncateText(String(key), MAX_SERIALIZED_VALUE_LENGTH);
}

/** 清洗运行时值（抄 sanitize_value：对象→可序列化，容器截断） */
export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncateText(value, MAX_SERIALIZED_VALUE_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    return value.slice(0, MAX_TRACE_CONTAINER_ITEMS).map((v) => sanitizeValue(v, depth + 1));
  }
  if (typeof value === "object") {
    if (depth > 4) return `<${(value as object).constructor?.name ?? "Object"}>`;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[keyName(k)] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** 装饰器配置（抄 runtime.py AgentMemoryConfig 核心字段） */
export interface AgentMemoryConfig {
  withMemory: boolean;
  withSessionMemory: boolean;
  saveSessionTraces: boolean;
  memoryQueryFixed?: string | null;
  memorySystemPrompt?: string | null;
  memoryTopK: number;
  sessionMemoryLastN: number;
  sessionId?: string | null;
  datasetName?: string | null;
  memoryOnlyContext: boolean;
}

/** 记忆上下文（抄 AgentMemoryContext 核心） */
export interface AgentMemoryContext {
  memory: string;
  sessionId: string;
  datasetName: string;
  scope: { user: string; datasetName: string };
}

export interface AgentMemoryHooks {
  /** 检索记忆上下文（抄 resolve：调 memify.search） */
  retrieveMemory: (query: string, topK: number, datasetName?: string | null) => Promise<string>;
  /** 持久化会话 trace（抄 persist_session_trace） */
  persistSession: (sessionId: string, content: string) => Promise<void>;
}

/**
 * agent_memory 装饰器（抄 decorator.py：给 async agent 函数加记忆上下文）
 * 用法：
 *   @agentMemory({ withMemory: true, memoryTopK: 5 })
 *   async function myAgent(prompt: string) { ... }
 */
export function agentMemory(
  config: Partial<AgentMemoryConfig> & { hooks: AgentMemoryHooks },
  target?: unknown,
  key?: string,
  descriptor?: PropertyDescriptor
): unknown {
  const cfg: AgentMemoryConfig = {
    withMemory: config.withMemory ?? true,
    withSessionMemory: config.withSessionMemory ?? false,
    saveSessionTraces: config.saveSessionTraces ?? false,
    memoryQueryFixed: config.memoryQueryFixed ?? null,
    memorySystemPrompt: config.memorySystemPrompt ?? null,
    memoryTopK: config.memoryTopK ?? 5,
    sessionMemoryLastN: config.sessionMemoryLastN ?? 5,
    sessionId: config.sessionId ?? null,
    datasetName: config.datasetName ?? null,
    memoryOnlyContext: config.memoryOnlyContext ?? false,
  };
  const hooks = config.hooks;

  // 支持 @agentMemory({...}) 返回装饰器 和 直接方法装饰两种
  if (target === undefined || descriptor === undefined) {
    return function decorator(fn: (...args: unknown[]) => unknown) {
      return wrapFn(fn, cfg, hooks);
    };
  }
  // 方法装饰（descriptor.value）
  if (descriptor?.value) {
    descriptor.value = wrapFn(descriptor.value, cfg, hooks);
    return descriptor;
  }
  return target;
}

function wrapFn(
  fn: (...args: unknown[]) => unknown,
  cfg: AgentMemoryConfig,
  hooks: AgentMemoryHooks
): (...args: unknown[]) => unknown {
  return async function (this: unknown, ...args: unknown[]) {
    const sessionId = cfg.sessionId ?? `session:${Date.now()}`;
    const datasetName = cfg.datasetName ?? null;
    // ① 检索记忆上下文（抄 resolve_agent_dataset_scope + retrieve）
    let memory = "";
    if (cfg.withMemory) {
      const query = cfg.memoryQueryFixed ?? String(args[0] ?? "");
      memory = await hooks.retrieveMemory(query, cfg.memoryTopK, datasetName);
    }
    // ② 调 agent（原函数）
    const result = await (fn as (...a: unknown[]) => unknown).apply(this, args);
    // ③ 持久化会话 trace（抄 persist_session_trace）
    if (cfg.saveSessionTraces || cfg.withSessionMemory) {
      const content = `${String(args[0] ?? "")}\n→\n${typeof result === "string" ? result : JSON.stringify(sanitizeValue(result))}`;
      await hooks.persistSession(sessionId, content);
    }
    // memoryOnlyContext：返回记忆上下文；否则原结果
    if (cfg.memoryOnlyContext) {
      const ctx: AgentMemoryContext = { memory, sessionId, datasetName: datasetName ?? "", scope: { user: "default", datasetName: datasetName ?? "" } };
      return ctx;
    }
    return result;
  };
}
