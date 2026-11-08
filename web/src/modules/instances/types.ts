// 简化版 CogneeInstance（抄 cognee modules/instances/types 核心字段）
export interface CogneeInstance {
  id: string;
  name?: string;
  // 自建知识库 API base（图谱数据端点）
  apiBase?: string;
}
