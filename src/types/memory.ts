/**
 * 记忆模型（抄 Cognee memify / agent_memory 核心）
 *
 * Cognee 记忆化思路：会话（对话/经验）→ 持久化进知识图谱
 * persist_sessions_in_knowledge_graph → 会话变可查询记忆。
 */

/** 记忆来源类型（抄 Cognee MemorySourceType） */
export type MemorySourceType =
  | "conversation"
  | "document"
  | "code"
  | "note"
  | "task"
  | "web_clip"
  | "other";

/** 记忆条目（一段可检索的记忆） */
export interface MemoryEntry {
  id: string;
  /** 记忆内容（verbatim 或总结） */
  content: string;
  /** 来源类型 */
  sourceType: MemorySourceType;
  /** 来源标识（如会话 id、文件路径、URL） */
  sourceRef: string;
  /** 时间戳（temporal 信息，cognee dateparser 处理） */
  timestamp: Date;
  /** 关联实体 id（图谱链接） */
  entityIds: string[];
  /** 向量嵌入（语义检索） */
  embedding: number[];
  /** 记忆强度/权重（feedback 加权） */
  weight: number;
  metadata: Record<string, unknown>;
}

/** 会话（对话）→ 记忆的输入 */
export interface Session {
  id: string;
  title?: string;
  /** 会话消息序列 */
  messages: Array<{
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    timestamp: Date;
  }>;
  /** 关联工作区/项目 */
  workspaceId?: string;
  metadata: Record<string, unknown>;
}

/** 记忆查询请求 */
export interface MemoryQuery {
  /** 语义检索文本 */
  text: string;
  /** 按实体过滤 */
  entityIds?: string[];
  /** 按来源类型过滤 */
  sourceType?: MemorySourceType;
  /** 时间范围 */
  since?: Date;
  until?: Date;
  topK: number;
}
