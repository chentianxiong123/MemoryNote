export interface ApiMe {
  id: string;
  name: string | null;
  email: string | null;
  workspaceId: string | null;
  phoneNumber: string | null;
  timezone: string | null;
  persona?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt?: string;
  unread?: boolean;
  status?: string | null;
}

export interface ConversationHistoryEntry {
  id: string;
  role: "user" | "assistant" | string;
  parts: Array<{ type: string; text?: string } & Record<string, unknown>>;
  createdAt?: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  incognito: boolean;
  ConversationHistory: ConversationHistoryEntry[];
}

export interface ConversationReplyResponse {
  assistantMessage: {
    id: string;
    role: "assistant" | string;
    text?: string;
    parts: ConversationHistoryEntry["parts"];
  };
  knowledgeCaptureBatch?: {
    id: string;
    summary: string;
    createdAt: string;
    itemCount: number;
    proposedCount: number;
  } | null;
  conversation: ConversationDetail | null;
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface DocumentRecord {
  id: string;
  title: string;
  source: string | null;
  type: string | null;
  createdAt: string;
  updatedAt: string;
  status?: string | null;
  ingestionQueueCount?: number;
  labelIds?: string[];
}

export interface DocumentsResponse {
  documents: DocumentRecord[];
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  availableSources: Array<{ name: string; slug: string }>;
  totalCount: number;
}

export interface LabelRecord {
  id: string;
  name: string;
  color: string;
  description?: string | null;
}

export interface GraphNodeRecord {
  uuid: string;
  name: string;
  labels: string[];
  createdAt: string;
  attributes: Record<string, unknown>;
}

export interface GraphEdgeRecord {
  uuid: string;
  type: string;
  source_node_uuid: string;
  target_node_uuid: string;
  createdAt: string;
  attributes: Record<string, unknown>;
}

export interface GraphTripletRecord {
  sourceNode: GraphNodeRecord;
  edge: GraphEdgeRecord;
  targetNode: GraphNodeRecord;
}

export interface GraphResponse {
  success: boolean;
  data?: {
    triplets: GraphTripletRecord[];
    clusters: LabelRecord[];
    hasMore?: boolean;
    requestedLimit?: number;
    summary?: {
      nodeCount: number;
      edgeCount: number;
      predicateCount: number;
    };
  };
  error?: string;
}

export interface KnowledgeCaptureItemRecord {
  id: string;
  graphObjectId: string | null;
  title: string;
  kind: string;
  status: string;
  confidence: number | null;
  importance: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  evidence: Record<string, unknown> | null;
}

export interface KnowledgeCaptureBatchRecord {
  id: string;
  summary: string;
  createdAt: string;
  status?: string;
  counts: {
    proposed: number;
    accepted: number;
    rejected: number;
    snoozed: number;
    merged: number;
  };
  items?: KnowledgeCaptureItemRecord[];
}

export interface KnowledgeHomeResponse {
  reviewQueue: {
    count: number;
    batchesCount: number;
  };
  recentGrowth: KnowledgeCaptureItemRecord[];
  recentBatches: KnowledgeCaptureBatchRecord[];
  activeProjects: Array<{
    id: string;
    title: string;
    type: string;
    weight: number;
  }>;
  activeTopics: Array<{
    id: string;
    title: string;
    type: string;
    weight: number;
  }>;
  recentEvents: KnowledgeCaptureItemRecord[];
  recentDecisions: KnowledgeCaptureItemRecord[];
  learningTrend: Array<{
    date: string;
    proposed: number;
    accepted: number;
  }>;
}

export interface KnowledgeInboxResponse {
  stats: {
    proposedCount: number;
    snoozedCount: number;
    batchCount: number;
  };
  batches: KnowledgeCaptureBatchRecord[];
}

export interface KnowledgeObjectDetailResponse {
  object: {
    id: string;
    uuid: string;
    kind: "entity" | "statement";
    title: string;
    type: string;
    summary: string;
    aliases: string[];
    attributes: Record<string, unknown>;
    createdAt: string;
    firstSeenAt: string;
    lastSeenAt: string;
    lastReviewedAt: string | null;
    confidence: number | null;
    evidenceCount: number;
    relationCount: number;
    relatedProjects: Array<{ uuid: string; name: string }>;
    relatedTerms: Array<{
      id: string;
      uuid: string;
      name: string;
      type: string;
      predicate: string;
    }>;
    timeline: Array<{ id: string; title: string; aspect: string | null; createdAt: string }>;
    evidence: KnowledgeCaptureItemRecord[];
    statements: Array<{
      id: string;
      uuid: string;
      title: string;
      aspect: string | null;
      createdAt: string;
      validAt: string;
      predicate: string;
      source: { uuid: string; name: string; type: string };
      target: { uuid: string; name: string; type: string };
      attributes: Record<string, unknown>;
      episodeUuids: string[];
    }>;
  };
}

export interface KnowledgeObjectGraphResponse {
  centerId: string;
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    primary: boolean;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    weight: number;
    aspect: string | null;
  }>;
  meta: {
    depth: number;
    truncated: boolean;
  };
}

export interface KnowledgeSearchResponse {
  results: Array<{
    id: string;
    title: string;
    type: string;
    kind: string;
  }>;
}

export interface WikiEntryResponse {
  id: string;
  entityUuid: string;
  title: string;
  definition: string;
  summary: string;
  content: string;
  userId: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiEntryVersionResponse {
  id: string;
  wikiEntryId: string;
  version: number;
  title: string;
  definition: string;
  summary: string;
  content: string;
  sourceEpisodeUuid: string | null;
  createdAt: string;
}

export interface WikiTimelineItem {
  uuid: string;
  fact: string;
  aspect: string | null;
  validAt: string;
  source: string;
}

export interface WikiEntryListResponse {
  entries: WikiEntryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ModelOption {
  id: string;
  modelId: string;
  label: string | null;
  provider: string;
  complexity?: string | null;
  supportsBatch?: boolean;
  capabilities: string[];
  isDefault?: boolean;
}

export interface WorkspaceModelSettings {
  modelConfig: Record<string, { modelId: string } | undefined>;
  embeddingConfig: {
    modelId: string;
    dimensions: number | null;
  };
  rerankConfig: {
    provider: string;
    modelId: string;
    threshold: number | null;
  };
  keyStatus: Array<{
    providerType: string;
    hasKey: boolean;
    keyPrefix: string | null;
    baseUrl?: string | null;
    apiMode?: string | null;
  }>;
  models: Array<{
    id: string;
    modelId: string;
    label: string | null;
    provider: { type: string; name: string };
    complexity?: string | null;
    supportsBatch?: boolean;
    capabilities: string[];
    isDefault?: boolean;
    dimensions?: number | null;
  }>;
  chatModels: Array<{
    id: string;
    modelId: string;
    label: string | null;
    provider: { type: string; name: string };
    complexity?: string | null;
    supportsBatch?: boolean;
    capabilities: string[];
    isDefault?: boolean;
    dimensions?: number | null;
  }>;
  embeddingModels: Array<{
    id: string;
    modelId: string;
    label: string | null;
    provider: { type: string; name: string };
    complexity?: string | null;
    supportsBatch?: boolean;
    capabilities: string[];
    isDefault?: boolean;
    dimensions?: number | null;
  }>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function toMessagePayload(text: string) {
  return {
    id: globalThis.crypto?.randomUUID?.(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}

export async function fetchMe() {
  return request<ApiMe>("/api/v1/me");
}

export async function fetchConversations(search = "") {
  const params = new URLSearchParams({ limit: "40" });
  if (search.trim()) params.set("search", search.trim());
  return request<ConversationsResponse>(`/api/v1/conversations?${params.toString()}`);
}

export async function fetchConversation(conversationId: string) {
  return request<ConversationDetail>(`/api/v1/conversation/${conversationId}`);
}

export async function createConversation(message: string) {
  return request<{ conversationId: string; conversationHistoryId: string }>(
    "/api/v1/conversation/create",
    {
      method: "POST",
      body: JSON.stringify({
        message,
        source: "core",
        incognito: false,
      }),
    },
  );
}

export async function triggerConversationResponse(
  conversationId: string,
  message: string,
  modelId?: string,
) {
  return request<ConversationReplyResponse>("/api/v1/conversation/reply", {
    method: "POST",
    body: JSON.stringify({
      id: conversationId,
      message,
      source: "core",
      ...(modelId ? { modelId } : {}),
    }),
  });
}

export async function fetchDocuments(params?: Record<string, string>) {
  const search = new URLSearchParams({
    limit: "25",
    ...(params ?? {}),
  });

  return request<DocumentsResponse>(`/api/v1/documents?${search.toString()}`);
}

export async function fetchLabels(search = "") {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<LabelRecord[]>(`/api/v1/labels${suffix}`);
}

export async function fetchGraph(limit?: number) {
  const query = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit)) {
    query.set("limit", String(limit));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<GraphResponse>(`/api/v1/graph/clustered${suffix}`);
}

export async function fetchKnowledgeHome() {
  return request<KnowledgeHomeResponse>("/api/v1/knowledge/home");
}

export async function fetchKnowledgeInbox() {
  return request<KnowledgeInboxResponse>("/api/v1/knowledge/inbox");
}

export async function acceptKnowledgeCaptureItem(itemId: string) {
  return request<{ success: boolean; item: KnowledgeCaptureItemRecord }>(
    `/api/v1/knowledge/inbox/${itemId}/accept`,
    { method: "POST" },
  );
}

export async function rejectKnowledgeCaptureItem(itemId: string) {
  return request<{ success: boolean; item: KnowledgeCaptureItemRecord }>(
    `/api/v1/knowledge/inbox/${itemId}/reject`,
    { method: "POST" },
  );
}

export async function snoozeKnowledgeCaptureItem(itemId: string) {
  return request<{ success: boolean; item: KnowledgeCaptureItemRecord }>(
    `/api/v1/knowledge/inbox/${itemId}/snooze`,
    { method: "POST" },
  );
}

export async function mergeKnowledgeCaptureItem(itemId: string, targetUuid: string) {
  return request<{ success: boolean; item: KnowledgeCaptureItemRecord }>(
    `/api/v1/knowledge/inbox/${itemId}/merge`,
    {
      method: "POST",
      body: JSON.stringify({ targetUuid }),
    },
  );
}

export async function acceptKnowledgeCaptureBatch(batchId: string) {
  return request<{ success: boolean; batch: KnowledgeCaptureBatchRecord }>(
    `/api/v1/knowledge/inbox/batches/${batchId}/accept`,
    { method: "POST" },
  );
}

export async function fetchKnowledgeObject(objectId: string) {
  return request<KnowledgeObjectDetailResponse>(`/api/v1/knowledge/objects/${objectId}`);
}

export async function fetchKnowledgeObjectGraph(
  objectId: string,
  params?: { depth?: number; limit?: number },
) {
  const query = new URLSearchParams();
  if (typeof params?.depth === "number") query.set("depth", String(params.depth));
  if (typeof params?.limit === "number") query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<KnowledgeObjectGraphResponse>(
    `/api/v1/knowledge/objects/${objectId}/graph${suffix}`,
  );
}

export async function searchKnowledgeObjects(queryText: string) {
  const query = new URLSearchParams({ q: queryText });
  return request<KnowledgeSearchResponse>(`/api/v1/knowledge/search?${query.toString()}`);
}

export async function fetchWikiEntries(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<WikiEntryListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<WikiEntryListResponse>(`/api/v1/wiki/entries${suffix}`);
}

export async function fetchWikiEntry(entityUuid: string): Promise<WikiEntryResponse | null> {
  return request<WikiEntryResponse | null>(`/api/v1/wiki/entries/${entityUuid}`);
}

export async function fetchWikiEntryVersions(entityUuid: string): Promise<WikiEntryVersionResponse[]> {
  return request<WikiEntryVersionResponse[]>(`/api/v1/wiki/entries/${entityUuid}/versions`);
}

export async function fetchWikiEntryTimeline(entityUuid: string): Promise<WikiTimelineItem[]> {
  return request<WikiTimelineItem[]>(`/api/v1/wiki/entries/${entityUuid}/timeline`);
}

export async function createGraphTriplet(payload: {
  subject: string;
  predicate: string;
  object: string;
  fact?: string;
  subjectType?: string;
  objectType?: string;
  aspect?: string;
}) {
  return request<{ success: boolean; triplet: GraphTripletRecord }>(
    "/api/v1/graph/triplets",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchModels() {
  return request<ModelOption[]>("/api/v1/llm-models");
}

export async function fetchWorkspaceModelSettings() {
  return request<WorkspaceModelSettings>("/api/v1/workspace/models");
}

export async function updateWorkspaceModel(useCase: string, modelId: string) {
  const form = new FormData();
  form.set("intent", "updateModel");
  form.set("useCase", useCase);
  form.set("modelId", modelId);

  const response = await fetch(`${API_BASE}/api/v1/workspace/models`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function setWorkspaceProviderKey(payload: {
  providerType: string;
  apiKey: string;
  baseUrl?: string;
  apiMode?: string;
}) {
  const form = new FormData();
  form.set("intent", "setKey");
  form.set("providerType", payload.providerType);
  form.set("apiKey", payload.apiKey);
  if (payload.baseUrl) form.set("baseUrl", payload.baseUrl);
  if (payload.apiMode) form.set("apiMode", payload.apiMode);

  const response = await fetch(`${API_BASE}/api/v1/workspace/models`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function deleteWorkspaceProviderKey(providerType: string) {
  const form = new FormData();
  form.set("intent", "deleteKey");
  form.set("providerType", providerType);

  const response = await fetch(`${API_BASE}/api/v1/workspace/models`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function updateWorkspaceEmbeddingConfig(payload: {
  modelId: string;
  dimensions?: number | null;
}) {
  const form = new FormData();
  form.set("intent", "updateEmbeddingConfig");
  form.set("modelId", payload.modelId);
  if (payload.dimensions !== undefined && payload.dimensions !== null) {
    form.set("dimensions", String(payload.dimensions));
  }

  const response = await fetch(`${API_BASE}/api/v1/workspace/models`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function updateWorkspaceRerankConfig(payload: {
  provider: string;
  modelId?: string;
  threshold?: number | null;
}) {
  const form = new FormData();
  form.set("intent", "updateRerankConfig");
  form.set("provider", payload.provider);
  if (payload.modelId) form.set("modelId", payload.modelId);
  if (payload.threshold !== undefined && payload.threshold !== null) {
    form.set("threshold", String(payload.threshold));
  }

  const response = await fetch(`${API_BASE}/api/v1/workspace/models`, {
    method: "POST",
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}
