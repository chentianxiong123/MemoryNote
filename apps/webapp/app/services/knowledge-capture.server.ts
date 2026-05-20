import crypto from "node:crypto";

import {
  EpisodeType,
  type EntityNode,
  type EntityType,
  type EpisodicNode,
  type StatementAspect,
  type StatementNode,
} from "@core/types";
import { logger } from "./logger.service";
import type {
  KnowledgeCaptureBatch,
  KnowledgeCaptureBatchStatus,
  KnowledgeCaptureItem,
  KnowledgeCaptureItemKind,
  KnowledgeCaptureItemStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "~/db.server";
import { makeStructuredModelCall } from "~/lib/model.server";
import {
  CombinedExtractionSchema,
  extractCombined,
  type CombinedExtraction,
} from "~/services/prompts/combined-extraction";
import { ProviderFactory } from "@core/providers";

const CanonicalRelations = [
  "is_a",
  "part_of",
  "related_to",
  "uses",
  "applies_to",
  "learned_from",
  "example_of",
  "contrasts_with",
  "causes",
  "blocks",
  "decided_in",
  "mentioned_with",
] as const;

type CanonicalRelation = (typeof CanonicalRelations)[number];

const CaptureItemPayloadSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
  definitionDraft: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  sourceText: z.string().optional(),
  source: z.string().optional(),
  sourceType: z.string().optional(),
  predicate: z.string().optional(),
  canonicalPredicate: z.enum(CanonicalRelations).optional(),
  target: z.string().optional(),
  targetType: z.string().optional(),
  fact: z.string().optional(),
  aspect: z.string().nullable().optional(),
  eventDate: z.string().nullable().optional(),
});

const MergeCaptureItemBodySchema = z.object({
  targetUuid: z.string().min(1),
});

type CaptureEvidence = {
  userMessage: string;
  assistantMessage: string;
  conversationId: string;
  sessionId: string;
  sourceType?: string;
  sourceLabel?: string;
  sourceTitle?: string;
};

type CaptureBatchSummary = {
  id: string;
  summary: string;
  createdAt: string;
  counts: {
    proposed: number;
    accepted: number;
    rejected: number;
    snoozed: number;
    merged: number;
  };
};

function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeStringList(values: unknown, exclude?: string): string[] {
  const rawValues = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(/[,\n，、]/)
      : [];
  const excluded = exclude?.trim().toLowerCase();
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of rawValues) {
    const text = String(value ?? "").trim();
    const key = text.toLowerCase();
    if (!text || text.length > 48 || key === excluded || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result.slice(0, 8);
}

function compactText(value: string, maxLength = 420) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function sourceTextFor(name: string, userMessage: string, assistantMessage: string) {
  const candidates = [userMessage, assistantMessage, `${userMessage}\n${assistantMessage}`];
  const matched = candidates.find((candidate) =>
    candidate.toLowerCase().includes(name.toLowerCase()),
  );
  return compactText(matched ?? candidates[candidates.length - 1] ?? "", 520);
}

const DefinitionDraftFallbacks: Record<string, string> = {
  MemoryNote: "一个由对话和笔记驱动的个人知识管理项目，用来沉淀可追溯的个人知识。",
  学习收件箱: "AI 从对话中提炼候选对象、关系、事件和决策后，等待用户确认入库的审核区。",
  对象详情: "个人知识库中某个词条的详情页，用来查看解释、时间、证据、关系和局部图。",
  局部图: "围绕单个词条展示的一跳或二跳关系图，用来避免一次性加载全量知识图谱。",
  知识工作台: "个人知识增长的二级工作区，用来查看收件箱、活跃主题、项目和近期沉淀。",
  时间与证据: "词条和关系背后的上下文层，记录什么时候出现、来自哪段对话或笔记。",
  关系: "连接两个知识词条的确认事实，底层使用标准化的 canonical relation。",
};

function entityTypeLabel(type: string | null | undefined) {
  const labels: Record<string, string> = {
    Person: "人物",
    Organization: "组织",
    Place: "地点",
    Event: "事件",
    Project: "项目",
    Task: "任务",
    Technology: "技术",
    Product: "产品",
    Standard: "标准",
    Concept: "概念",
    Predicate: "关系词",
  };
  return labels[type ?? ""] ?? "知识对象";
}

function isLikelyEntityName(name: string) {
  const text = name.trim();
  if (!text || text.length > 56) return false;
  if (/[。！？?!\r\n]/.test(text)) return false;
  if (text.split(/\s+/).length > 8) return false;
  return true;
}

function sanitizeEntityAttributes(attributes: unknown) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return {};
  }

  const result = { ...(attributes as Record<string, unknown>) };
  delete result.definition;
  delete result.definitionDraft;
  delete result.definition_draft;
  delete result.alias;
  delete result.aliases;
  delete result.sourceText;
  return result;
}

function definitionDraftFor(
  entity: CombinedExtraction["entities"][number],
  statements: CombinedExtraction["statements"],
) {
  const attributes =
    entity.attributes && typeof entity.attributes === "object" ? entity.attributes : {};
  const explicit =
    typeof (entity as { definition_draft?: unknown }).definition_draft === "string"
      ? (entity as { definition_draft: string }).definition_draft
      : typeof attributes.definitionDraft === "string"
        ? attributes.definitionDraft
        : typeof attributes.definition === "string"
          ? attributes.definition
          : null;
  if (explicit?.trim()) return compactText(explicit, 220);

  const fallback = DefinitionDraftFallbacks[entity.name];
  if (fallback) return fallback;

  const relatedFact = statements.find(
    (statement) => statement.source === entity.name || statement.target === entity.name,
  )?.fact;
  if (relatedFact?.trim()) {
    return compactText(
      `${entity.name} 是本轮对话中提到的${entityTypeLabel(entity.type)}，相关事实是：${relatedFact}`,
      220,
    );
  }

  return compactText(
    `${entity.name} 是本轮对话中提到的${entityTypeLabel(entity.type)}，具体解释需要你确认后继续补充。`,
    220,
  );
}

function aliasesFor(entity: CombinedExtraction["entities"][number]) {
  const attributes =
    entity.attributes && typeof entity.attributes === "object" ? entity.attributes : {};
  const explicitAliases = (entity as { aliases?: unknown }).aliases;
  return normalizeStringList(
    explicitAliases ?? attributes.aliases ?? attributes.alias,
    entity.name,
  );
}

function mergeIsoDate(
  current: unknown,
  incoming: Date,
  direction: "earliest" | "latest",
) {
  if (typeof current !== "string" || !current) return incoming.toISOString();
  const currentTime = Date.parse(current);
  if (!Number.isFinite(currentTime)) return incoming.toISOString();
  const incomingTime = incoming.getTime();
  if (direction === "earliest") {
    return currentTime <= incomingTime ? current : incoming.toISOString();
  }
  return currentTime >= incomingTime ? current : incoming.toISOString();
}

function acceptedEntityAttributes(
  payload: z.infer<typeof CaptureItemPayloadSchema>,
  item: KnowledgeCaptureItem,
) {
  const attributes: Record<string, unknown> = {
    ...(payload.attributes ?? {}),
  };
  const definitionDraft = payload.definitionDraft?.trim();
  const aliases = normalizeStringList(payload.aliases, payload.name);

  if (definitionDraft) {
    attributes.definition = definitionDraft;
    attributes.definitionUpdatedAt = new Date().toISOString();
  }
  if (aliases.length > 0) {
    attributes.aliases = aliases;
  }
  attributes.sourceEvidenceIds = [item.id];
  attributes.sourceCaptureBatchIds = [item.batchId];

  return attributes;
}

function fallbackCombinedExtraction(
  userMessage: string,
  assistantMessage: string,
): CombinedExtraction | null {
  const combined = `${userMessage}\n${assistantMessage}`.trim();
  if (!combined) return null;

  const entities = uniqueByName(
    [
      /\bMemoryNote\b/i.test(combined)
        ? {
            name: "MemoryNote",
            type: "Project" as EntityType,
            definition_draft: DefinitionDraftFallbacks.MemoryNote,
            aliases: null,
            attributes: null,
          }
        : null,
      /学习收件箱/.test(combined)
        ? {
            name: "学习收件箱",
            type: "Concept" as EntityType,
            definition_draft: DefinitionDraftFallbacks.学习收件箱,
            aliases: null,
            attributes: null,
          }
        : null,
      /对象详情/.test(combined)
        ? {
            name: "对象详情",
            type: "Concept" as EntityType,
            definition_draft: DefinitionDraftFallbacks.对象详情,
            aliases: null,
            attributes: null,
          }
        : null,
      /局部图/.test(combined)
        ? {
            name: "局部图",
            type: "Concept" as EntityType,
            definition_draft: DefinitionDraftFallbacks.局部图,
            aliases: null,
            attributes: null,
          }
        : null,
      /知识工作台/.test(combined)
        ? {
            name: "知识工作台",
            type: "Project" as EntityType,
            definition_draft: DefinitionDraftFallbacks.知识工作台,
            aliases: null,
            attributes: null,
          }
        : null,
      /时间和证据|时间与证据/.test(combined)
        ? {
            name: "时间与证据",
            type: "Concept" as EntityType,
            definition_draft: DefinitionDraftFallbacks.时间与证据,
            aliases: ["时间和证据"],
            attributes: null,
          }
        : null,
    ].filter(Boolean) as Array<{
      name: string;
      type: EntityType;
      definition_draft: string | null;
      aliases: string[] | null;
      attributes: Record<string, string | number | boolean | null> | null;
    }>,
  );

  const sentences = combined
    .split(/[\r\n]+|(?<=[。！？!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  const decisionSentence =
    sentences.find((item) => /决定|先用|主入口|不再|不要|优先/.test(item)) ?? null;
  const evidenceSentence =
    sentences.find((item) => /时间和证据|时间与证据|保留.*证据|保留.*时间/.test(item)) ?? null;

  const statements: CombinedExtraction["statements"] = [];

  if (decisionSentence && /学习收件箱/.test(combined)) {
    statements.push({
      source: /知识工作台/.test(combined) ? "知识工作台" : "MemoryNote",
      predicate: "prioritizes",
      target: "学习收件箱",
      fact: decisionSentence.slice(0, 120),
      aspect: "Decision",
      event_date: null,
    });
  }

  if (evidenceSentence && /时间和证据|时间与证据/.test(combined)) {
    statements.push({
      source: "关系",
      predicate: "preserves",
      target: "时间与证据",
      fact: evidenceSentence.slice(0, 120),
      aspect: "Knowledge",
      event_date: null,
    });

    if (!entities.some((item) => item.name === "关系")) {
      entities.push({
        name: "关系",
        type: "Concept",
        definition_draft: DefinitionDraftFallbacks.关系,
        aliases: null,
        attributes: null,
      });
    }
  }

  if (entities.length === 0 && statements.length === 0) {
    return null;
  }

  return {
    entities,
    statements,
  };
}

export type KnowledgeCaptureBatchWithItems = KnowledgeCaptureBatch & {
  items: KnowledgeCaptureItem[];
};

function normalizeEntityType(type: string | null | undefined): EntityType {
  const allowed = new Set<string>([
    "Person",
    "Organization",
    "Place",
    "Event",
    "Project",
    "Task",
    "Technology",
    "Product",
    "Standard",
    "Concept",
    "Predicate",
  ]);

  if (type && allowed.has(type)) {
    return type as EntityType;
  }

  return "Concept";
}

function normalizePredicate(raw: string): CanonicalRelation {
  const value = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

  const aliases: Record<string, CanonicalRelation> = {
    is: "is_a",
    are: "is_a",
    is_a: "is_a",
    type_of: "is_a",
    kind_of: "is_a",
    part_of: "part_of",
    belongs_to: "part_of",
    inside: "part_of",
    includes: "part_of",
    contains: "part_of",
    related_to: "related_to",
    relates_to: "related_to",
    connects_to: "related_to",
    associated_with: "related_to",
    uses: "uses",
    used_by: "uses",
    built_with: "uses",
    powers: "uses",
    applies_to: "applies_to",
    useful_for: "applies_to",
    relevant_to: "applies_to",
    learned_from: "learned_from",
    came_from: "learned_from",
    sourced_from: "learned_from",
    example_of: "example_of",
    demonstrates: "example_of",
    contrasts_with: "contrasts_with",
    compared_to: "contrasts_with",
    versus: "contrasts_with",
    causes: "causes",
    leads_to: "causes",
    results_in: "causes",
    blocks: "blocks",
    prevents: "blocks",
    decided_in: "decided_in",
    chosen_in: "decided_in",
    mentioned_with: "mentioned_with",
    discussed_with: "mentioned_with",
  };

  return aliases[value] ?? "related_to";
}

function deriveSummary(extraction: CombinedExtraction): string {
  const topEntities = extraction.entities
    .slice(0, 3)
    .map((entity) => entity.name)
    .filter(Boolean);
  const topStatements = extraction.statements
    .slice(0, 2)
    .map((statement) => statement.fact)
    .filter(Boolean);

  if (topEntities.length === 0 && topStatements.length === 0) {
    return "本轮对话暂未形成可沉淀的长期知识。";
  }

  const parts: string[] = [];
  if (topEntities.length > 0) {
    parts.push(`提炼了 ${topEntities.join("、")}`);
  }
  if (topStatements.length > 0) {
    parts.push(`关联到 ${topStatements.join("；")}`);
  }

  return parts.join("，").slice(0, 220);
}

function createSyntheticEpisode(batch: KnowledgeCaptureBatch, evidence: CaptureEvidence): EpisodicNode {
  const timestamp = new Date();
  return {
    uuid: `knowledge-capture:${batch.id}`,
    content: `${batch.summary}\n\nUser: ${evidence.userMessage}\nAssistant: ${evidence.assistantMessage}`,
    originalContent: `${evidence.userMessage}\n\n${evidence.assistantMessage}`,
    metadata: {
      sourceMode: "knowledge-capture",
      batchId: batch.id,
      conversationId: batch.conversationId,
    },
    source: "knowledge-capture",
    createdAt: timestamp,
    validAt: timestamp,
    labelIds: [],
    userId: batch.userId,
    workspaceId: batch.workspaceId,
    sessionId: batch.sessionId,
    queueId: batch.id,
    type: EpisodeType.CONVERSATION,
  };
}

function entityUuidFor(name: string, type: EntityType) {
  const hash = crypto
    .createHash("sha1")
    .update(`${type}:${name.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 20);
  return `knowledge-entity:${hash}`;
}

function statementUuidFor(payload: {
  source: string;
  predicate: string;
  target: string;
  fact: string;
  batchId: string;
}) {
  const hash = crypto
    .createHash("sha1")
    .update(
      `${payload.batchId}:${payload.source}:${payload.predicate}:${payload.target}:${payload.fact}`,
    )
    .digest("hex")
    .slice(0, 24);
  return `knowledge-statement:${hash}`;
}

function summarizeBatch(batch: KnowledgeCaptureBatchWithItems): CaptureBatchSummary {
  const counts = {
    proposed: 0,
    accepted: 0,
    rejected: 0,
    snoozed: 0,
    merged: 0,
  };

  for (const item of batch.items) {
    switch (item.status) {
      case "PROPOSED":
        counts.proposed += 1;
        break;
      case "ACCEPTED":
        counts.accepted += 1;
        break;
      case "REJECTED":
        counts.rejected += 1;
        break;
      case "SNOOZED":
        counts.snoozed += 1;
        break;
      case "MERGED":
        counts.merged += 1;
        break;
    }
  }

  return {
    id: batch.id,
    summary: batch.summary,
    createdAt: batch.createdAt.toISOString(),
    counts,
  };
}

function itemKindForAspect(aspect: StatementAspect | null | undefined): KnowledgeCaptureItemKind {
  if (aspect === "Event") return "EVENT";
  if (aspect === "Decision") return "DECISION";
  return "RELATION";
}

async function resolveEntity(
  graphProvider: ReturnType<typeof ProviderFactory.getGraphProvider>,
  params: {
    name: string;
    type: EntityType;
    attributes?: Record<string, unknown>;
    firstSeenAt: Date;
    lastSeenAt: Date;
    confidence?: number | null;
    importance?: number | null;
    userId: string;
    workspaceId: string;
  },
): Promise<EntityNode> {
  const existing = await graphProvider.findExactEntityMatch({
    entityName: params.name,
    userId: params.userId,
    workspaceId: params.workspaceId,
  });

  const existingAttributes = existing?.attributes ?? {};
  const incomingAttributes = params.attributes ?? {};
  const mergedAliases = normalizeStringList(
    [
      ...normalizeStringList(existingAttributes.aliases),
      ...normalizeStringList(incomingAttributes.aliases),
    ],
    params.name,
  );
  const mergedEvidenceIds = normalizeStringList([
    ...normalizeStringList(existingAttributes.sourceEvidenceIds),
    ...normalizeStringList(incomingAttributes.sourceEvidenceIds),
  ]);
  const mergedBatchIds = normalizeStringList([
    ...normalizeStringList(existingAttributes.sourceCaptureBatchIds),
    ...normalizeStringList(incomingAttributes.sourceCaptureBatchIds),
  ]);

  const mergedAttributes = {
    ...existingAttributes,
    ...incomingAttributes,
    sourceMode: "knowledge-capture",
    firstSeenAt: mergeIsoDate(existingAttributes.firstSeenAt, params.firstSeenAt, "earliest"),
    lastSeenAt: mergeIsoDate(existingAttributes.lastSeenAt, params.lastSeenAt, "latest"),
    confidence: params.confidence ?? undefined,
    importance: params.importance ?? undefined,
    status: "confirmed",
    ...(mergedAliases.length > 0 ? { aliases: mergedAliases } : {}),
    ...(mergedEvidenceIds.length > 0 ? { sourceEvidenceIds: mergedEvidenceIds } : {}),
    ...(mergedBatchIds.length > 0 ? { sourceCaptureBatchIds: mergedBatchIds } : {}),
  };

  return {
    uuid: existing?.uuid ?? entityUuidFor(params.name, params.type),
    name: params.name,
    type: params.type,
    attributes: mergedAttributes,
    createdAt: existing?.createdAt ?? new Date(),
    userId: params.userId,
    workspaceId: params.workspaceId,
  };
}

async function resolvePredicate(
  graphProvider: ReturnType<typeof ProviderFactory.getGraphProvider>,
  predicate: string,
  userId: string,
  workspaceId: string,
): Promise<EntityNode> {
  const matches = await graphProvider.findExactPredicateMatches({
    predicateName: predicate,
    userId,
    workspaceId,
  });

  const existing = matches[0];
  return {
    uuid: existing?.uuid ?? entityUuidFor(predicate, "Predicate"),
    name: predicate,
    type: "Predicate",
    attributes: {
      ...(existing?.attributes ?? {}),
      sourceMode: "knowledge-capture",
    },
    createdAt: existing?.createdAt ?? new Date(),
    userId,
    workspaceId,
  };
}

async function ensureBatchEpisode(
  graphProvider: ReturnType<typeof ProviderFactory.getGraphProvider>,
  batch: KnowledgeCaptureBatch,
  evidence: CaptureEvidence,
) {
  const episode = createSyntheticEpisode(batch, evidence);
  await graphProvider.saveEpisode(episode);
  return episode.uuid;
}

export async function generateKnowledgeCaptureBatch(params: {
  conversationId: string;
  sessionId: string;
  userId: string;
  workspaceId: string;
  userName?: string | null;
  userMessage: string;
  assistantMessage: string;
}): Promise<KnowledgeCaptureBatchWithItems | null> {
  const episodeContent = `<user>${params.userMessage}</user>\n<assistant>${params.assistantMessage}</assistant>`;

  if (!params.userMessage.trim() && !params.assistantMessage.trim()) {
    return null;
  }

  const extraction = await makeStructuredModelCall(
    CombinedExtractionSchema,
    extractCombined({
      userName: params.userName ?? undefined,
      episodeContent,
    }),
    "low",
    undefined,
    undefined,
    params.workspaceId,
    "chat",
  ).catch(() => null);

  const capture =
    extraction?.object ??
    fallbackCombinedExtraction(params.userMessage, params.assistantMessage);

  if (!capture) {
    return null;
  }

  const captureEntities = uniqueByName(
    capture.entities.filter((entity) => isLikelyEntityName(entity.name)),
  );
  const captureStatements = capture.statements.filter((statement) => statement.fact?.trim());
  const normalizedCapture: CombinedExtraction = {
    entities: captureEntities,
    statements: captureStatements,
  };
  const summary = deriveSummary(normalizedCapture);
  if (normalizedCapture.entities.length === 0 && normalizedCapture.statements.length === 0) {
    return null;
  }
  const firstSeenAt = new Date();
  const lastSeenAt = new Date();
  const evidence: CaptureEvidence = {
    userMessage: params.userMessage,
    assistantMessage: params.assistantMessage,
    conversationId: params.conversationId,
    sessionId: params.sessionId,
    sourceType: "conversation",
    sourceLabel: "对话",
    sourceTitle: "AI 对话 recap",
  };
  const captureItemCreates: Prisma.KnowledgeCaptureItemUncheckedCreateWithoutBatchInput[] = [
    ...normalizedCapture.entities.map((entity) => ({
      kind: "ENTITY" as const,
      title: entity.name,
      payload: {
        name: entity.name,
        type: entity.type ?? "Concept",
        attributes: sanitizeEntityAttributes(entity.attributes),
        definitionDraft: definitionDraftFor(entity, normalizedCapture.statements),
        aliases: aliasesFor(entity),
        sourceText: sourceTextFor(entity.name, params.userMessage, params.assistantMessage),
      } as Prisma.InputJsonValue,
      confidence: 0.72,
      importance: 0.55,
      evidence: evidence as Prisma.InputJsonValue,
      firstSeenAt,
      lastSeenAt,
      userId: params.userId,
      workspaceId: params.workspaceId,
    })),
    ...normalizedCapture.statements.map((statement) => ({
      kind: itemKindForAspect(statement.aspect as StatementAspect | null | undefined),
      title: statement.fact,
      payload: {
        source: statement.source,
        sourceType:
          normalizedCapture.entities.find((entity) => entity.name === statement.source)?.type ??
          "Concept",
        predicate: statement.predicate,
        canonicalPredicate: normalizePredicate(statement.predicate),
        target: statement.target,
        targetType:
          normalizedCapture.entities.find((entity) => entity.name === statement.target)?.type ??
          "Concept",
        fact: statement.fact,
        aspect: statement.aspect,
        eventDate: statement.event_date,
        sourceText: compactText(
          statement.fact || sourceTextFor(statement.source, params.userMessage, params.assistantMessage),
          520,
        ),
      } as Prisma.InputJsonValue,
      confidence: 0.7,
      importance:
        statement.aspect === "Decision" || statement.aspect === "Event" ? 0.82 : 0.58,
      evidence: evidence as Prisma.InputJsonValue,
      firstSeenAt,
      lastSeenAt,
      userId: params.userId,
      workspaceId: params.workspaceId,
    })),
  ];

  const batch = await prisma.knowledgeCaptureBatch.create({
    data: {
      conversationId: params.conversationId,
      sessionId: params.sessionId,
      userId: params.userId,
      workspaceId: params.workspaceId,
      summary,
      status: "PROPOSED",
      sourceEpisodeUuids: [],
      items: {
        create: captureItemCreates,
      },
    },
    include: {
      items: {
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return batch as KnowledgeCaptureBatchWithItems;
}

async function getCaptureItemOrThrow(itemId: string, userId: string, workspaceId: string) {
  const item = await prisma.knowledgeCaptureItem.findFirst({
    where: {
      id: itemId,
      userId,
      workspaceId,
    },
    include: {
      batch: true,
    },
  });

  if (!item) {
    throw new Error("Knowledge capture item not found.");
  }

  return item;
}

export async function acceptKnowledgeCaptureItem(itemId: string, userId: string, workspaceId: string) {
  const item = await getCaptureItemOrThrow(itemId, userId, workspaceId);
  const payload = CaptureItemPayloadSchema.parse(item.payload);
  const evidence = (item.evidence ?? {}) as CaptureEvidence;
  const graphProvider = ProviderFactory.getGraphProvider();
  const firstSeenAt = item.firstSeenAt;
  const lastSeenAt = item.lastSeenAt;

  if (item.status === "ACCEPTED" || item.status === "MERGED") {
    return prisma.knowledgeCaptureItem.findUnique({ where: { id: item.id } });
  }

  if (item.kind === "ENTITY") {
    const entityName = payload.name?.trim();
    if (!entityName) {
      throw new Error("Entity item is missing a name.");
    }

    const entity = await resolveEntity(graphProvider, {
      name: entityName,
      type: normalizeEntityType(payload.type),
      attributes: acceptedEntityAttributes(payload, item),
      firstSeenAt,
      lastSeenAt,
      confidence: item.confidence,
      importance: item.importance,
      userId,
      workspaceId,
    });

    await graphProvider.saveEntity(entity);

    // Auto-publish the corresponding Wiki draft, if one exists. The user has
    // already vouched for the entity, so the draft entry doesn't need a
    // second review pass.
    try {
      const { publishWikiEntryByEntity } = await import("./wikiEntry.server");
      await publishWikiEntryByEntity({ entityUuid: entity.uuid, workspaceId, prisma });
    } catch (err) {
      logger.warn("Failed to auto-publish wiki draft on entity accept", {
        entityUuid: entity.uuid,
        error: err,
      });
    }

    return prisma.knowledgeCaptureItem.update({
      where: { id: item.id },
      data: {
        status: "ACCEPTED",
        acceptedGraphUuid: entity.uuid,
        lastReviewedAt: new Date(),
      },
    });
  }

  const sourceName = payload.source?.trim();
  const targetName = payload.target?.trim();
  const predicateName = payload.predicate?.trim();
  const fact = payload.fact?.trim();

  if (!sourceName || !targetName || !predicateName || !fact) {
    throw new Error("Relation item is missing required graph fields.");
  }

  const subject = await resolveEntity(graphProvider, {
    name: sourceName,
    type: normalizeEntityType(payload.sourceType),
    firstSeenAt,
    lastSeenAt,
    confidence: item.confidence,
    importance: item.importance,
    userId,
    workspaceId,
  });
  const object = await resolveEntity(graphProvider, {
    name: targetName,
    type: normalizeEntityType(payload.targetType),
    firstSeenAt,
    lastSeenAt,
    confidence: item.confidence,
    importance: item.importance,
    userId,
    workspaceId,
  });
  const predicate = await resolvePredicate(graphProvider, predicateName, userId, workspaceId);

  await graphProvider.saveEntity(subject);
  await graphProvider.saveEntity(object);
  await graphProvider.saveEntity(predicate);

  const episodeUuid = await ensureBatchEpisode(graphProvider, item.batch, evidence);
  const validAt = payload.eventDate ? new Date(payload.eventDate) : new Date();
  const statementUuid = statementUuidFor({
    source: sourceName,
    predicate: predicateName,
    target: targetName,
    fact,
    batchId: item.batchId,
  });

  const statement: StatementNode = {
    uuid: statementUuid,
    fact,
    factEmbedding: [],
    createdAt: new Date(),
    validAt,
    invalidAt: null,
    attributes: {
      sourceMode: "knowledge-capture",
      originalPredicate: predicateName,
      canonicalPredicate: payload.canonicalPredicate ?? normalizePredicate(predicateName),
      confidence: item.confidence ?? undefined,
      importance: item.importance ?? undefined,
      captureItemId: item.id,
      captureBatchId: item.batchId,
      eventDate: payload.eventDate ?? null,
      evidence,
    },
    userId,
    workspaceId,
    aspect: (payload.aspect as StatementAspect | null | undefined) ?? null,
    provenanceCount: 1,
  };

  await graphProvider.saveTriple({
    statement,
    subject,
    predicate,
    object,
    episodeUuid,
    userId,
    workspaceId,
  });

  return prisma.knowledgeCaptureItem.update({
    where: { id: item.id },
    data: {
      status: "ACCEPTED",
      acceptedGraphUuid: statement.uuid,
      lastReviewedAt: new Date(),
    },
  });
}

export async function acceptKnowledgeCaptureBatch(batchId: string, userId: string, workspaceId: string) {
  const batch = await prisma.knowledgeCaptureBatch.findFirst({
    where: {
      id: batchId,
      userId,
      workspaceId,
    },
    include: {
      items: {
        where: {
          status: { in: ["PROPOSED", "SNOOZED"] },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!batch) {
    throw new Error("Knowledge capture batch not found.");
  }

  for (const item of batch.items) {
    await acceptKnowledgeCaptureItem(item.id, userId, workspaceId);
  }

  return prisma.knowledgeCaptureBatch.findUnique({
    where: { id: batchId },
    include: { items: true },
  });
}

export async function rejectKnowledgeCaptureBatch(
  batchId: string,
  userId: string,
  workspaceId: string,
  options?: { reason?: CaptureRejectReason; notes?: string },
) {
  const batch = await prisma.knowledgeCaptureBatch.findFirst({
    where: { id: batchId, userId, workspaceId },
    include: {
      items: {
        where: { status: { in: ["PROPOSED", "SNOOZED"] } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!batch) {
    throw new Error("Knowledge capture batch not found.");
  }

  for (const item of batch.items) {
    await rejectKnowledgeCaptureItem(item.id, userId, workspaceId, options);
  }

  return prisma.knowledgeCaptureBatch.findUnique({
    where: { id: batchId },
    include: { items: true },
  });
}

export type CaptureRejectReason =
  | "INACCURATE"
  | "IRRELEVANT"
  | "DUPLICATE"
  | "TRIVIAL"
  | "OTHER";

export async function rejectKnowledgeCaptureItem(
  itemId: string,
  userId: string,
  workspaceId: string,
  options?: { reason?: CaptureRejectReason; notes?: string },
) {
  await getCaptureItemOrThrow(itemId, userId, workspaceId);
  return prisma.knowledgeCaptureItem.update({
    where: { id: itemId },
    data: {
      status: "REJECTED",
      lastReviewedAt: new Date(),
      rejectReason: options?.reason ?? null,
      reviewNotes: options?.notes?.trim() || null,
    },
  });
}

export async function snoozeKnowledgeCaptureItem(itemId: string, userId: string, workspaceId: string) {
  await getCaptureItemOrThrow(itemId, userId, workspaceId);
  return prisma.knowledgeCaptureItem.update({
    where: { id: itemId },
    data: {
      status: "SNOOZED",
      lastReviewedAt: new Date(),
    },
  });
}

export async function mergeKnowledgeCaptureItem(
  itemId: string,
  body: z.infer<typeof MergeCaptureItemBodySchema>,
  userId: string,
  workspaceId: string,
) {
  const item = await getCaptureItemOrThrow(itemId, userId, workspaceId);
  const payload = CaptureItemPayloadSchema.parse(item.payload);
  const graphProvider = ProviderFactory.getGraphProvider();

  if (item.kind === "ENTITY") {
    const target = await graphProvider.getEntity(body.targetUuid, userId, workspaceId);
    if (!target) {
      throw new Error("Merge target entity not found.");
    }

    const targetAttributes = target.attributes ?? {};
    const incomingAttributes = acceptedEntityAttributes(payload, item);
    const targetHasDefinition =
      typeof targetAttributes.definition === "string" &&
      targetAttributes.definition.trim().length > 0;
    const mergedAliases = normalizeStringList(
      [
        ...normalizeStringList(targetAttributes.aliases),
        ...normalizeStringList(incomingAttributes.aliases),
        payload.name,
      ],
      target.name,
    );
    const mergedEvidenceIds = normalizeStringList([
      ...normalizeStringList(targetAttributes.sourceEvidenceIds),
      ...normalizeStringList(incomingAttributes.sourceEvidenceIds),
    ]);
    const mergedBatchIds = normalizeStringList([
      ...normalizeStringList(targetAttributes.sourceCaptureBatchIds),
      ...normalizeStringList(incomingAttributes.sourceCaptureBatchIds),
    ]);
    const mergedAttributes: Record<string, unknown> = {
      ...targetAttributes,
      ...incomingAttributes,
      ...(targetHasDefinition
        ? {
            definition: targetAttributes.definition,
            definitionUpdatedAt: targetAttributes.definitionUpdatedAt,
          }
        : {}),
      firstSeenAt: mergeIsoDate(targetAttributes.firstSeenAt, item.firstSeenAt, "earliest"),
      lastSeenAt: mergeIsoDate(targetAttributes.lastSeenAt, item.lastSeenAt, "latest"),
      aliases: mergedAliases,
      sourceEvidenceIds: mergedEvidenceIds,
      sourceCaptureBatchIds: mergedBatchIds,
      lastReviewedAt: new Date().toISOString(),
    };

    await graphProvider.saveEntity({
      ...target,
      attributes: mergedAttributes,
      userId,
      workspaceId,
    });
  }

  return prisma.knowledgeCaptureItem.update({
    where: { id: itemId },
    data: {
      status: "MERGED",
      mergeTargetUuid: body.targetUuid,
      acceptedGraphUuid: body.targetUuid,
      lastReviewedAt: new Date(),
    },
  });
}

export function parseMergeCaptureItemBody(value: unknown) {
  return MergeCaptureItemBodySchema.parse(value);
}

function toKnowledgeObjectId(kind: "entity" | "statement", uuid: string) {
  return `${kind}:${uuid}`;
}

function summarizeEvidence(evidence: unknown) {
  const value =
    evidence && typeof evidence === "object" && !Array.isArray(evidence)
      ? (evidence as Record<string, unknown>)
      : {};
  const sourceType = typeof value.sourceType === "string" ? value.sourceType : "conversation";
  const sourceLabels: Record<string, string> = {
    conversation: "对话",
    note: "笔记",
    document: "文档",
    web: "网页摘录",
  };

  return {
    ...value,
    sourceType,
    sourceLabel:
      typeof value.sourceLabel === "string" ? value.sourceLabel : sourceLabels[sourceType] ?? "对话",
  };
}

function summarizeCaptureItem(item: KnowledgeCaptureItem) {
  const payload = CaptureItemPayloadSchema.parse(item.payload);
  return {
    id: item.id,
    graphObjectId:
      item.kind === "ENTITY"
        ? item.acceptedGraphUuid
          ? toKnowledgeObjectId("entity", item.acceptedGraphUuid)
          : null
        : item.acceptedGraphUuid
          ? toKnowledgeObjectId("statement", item.acceptedGraphUuid)
          : null,
    title: item.title,
    kind: item.kind.toLowerCase(),
    status: item.status.toLowerCase(),
    confidence: item.confidence,
    importance: item.importance,
    firstSeenAt: item.firstSeenAt.toISOString(),
    lastSeenAt: item.lastSeenAt.toISOString(),
    lastReviewedAt: item.lastReviewedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    payload,
    evidence: summarizeEvidence(item.evidence),
  };
}

export async function getKnowledgeInboxData(userId: string, workspaceId: string) {
  const batches = await prisma.knowledgeCaptureBatch.findMany({
    where: {
      userId,
      workspaceId,
    },
    include: {
      items: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const proposedCount = await prisma.knowledgeCaptureItem.count({
    where: {
      userId,
      workspaceId,
      status: "PROPOSED",
    },
  });

  const snoozedCount = await prisma.knowledgeCaptureItem.count({
    where: {
      userId,
      workspaceId,
      status: "SNOOZED",
    },
  });

  return {
    stats: {
      proposedCount,
      snoozedCount,
      batchCount: batches.length,
    },
    batches: batches.map((batch) => ({
      ...summarizeBatch(batch as KnowledgeCaptureBatchWithItems),
      status: batch.status.toLowerCase(),
      items: batch.items.map(summarizeCaptureItem),
    })),
  };
}

export async function getKnowledgeHomeData(userId: string, workspaceId: string) {
  const [reviewQueueCount, recentAcceptedItems, recentBatches, proposedItems, eventItems, decisionItems] =
    await Promise.all([
      prisma.knowledgeCaptureItem.count({
        where: {
          userId,
          workspaceId,
          status: { in: ["PROPOSED", "SNOOZED"] },
        },
      }),
      prisma.knowledgeCaptureItem.findMany({
        where: {
          userId,
          workspaceId,
          status: { in: ["ACCEPTED", "MERGED"] },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.knowledgeCaptureBatch.findMany({
        where: {
          userId,
          workspaceId,
        },
        include: {
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.knowledgeCaptureItem.findMany({
        where: {
          userId,
          workspaceId,
          createdAt: {
            gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.knowledgeCaptureItem.findMany({
        where: {
          userId,
          workspaceId,
          kind: "EVENT",
          status: "ACCEPTED",
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.knowledgeCaptureItem.findMany({
        where: {
          userId,
          workspaceId,
          kind: "DECISION",
          status: "ACCEPTED",
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
    ]);

  const graphProvider = ProviderFactory.getGraphProvider();

  const [projectRows, topicRows] = await Promise.all([
    graphProvider.runQuery(
      `
        MATCH (e:Entity {userId: $userId, workspaceId: $workspaceId})
        WHERE e.type = 'Project'
        OPTIONAL MATCH (statement:Statement {userId: $userId, workspaceId: $workspaceId})-[:HAS_SUBJECT|HAS_OBJECT]->(e)
        RETURN e.uuid as uuid, e.name as name, e.type as type, e.attributes as attributes, count(statement) as weight
        ORDER BY weight DESC, name ASC
        LIMIT 8
      `,
      { userId, workspaceId },
    ) as Promise<Array<{ get: (key: string) => unknown }>>,
    graphProvider.runQuery(
      `
        MATCH (e:Entity {userId: $userId, workspaceId: $workspaceId})
        WHERE e.type IN ['Concept', 'Technology', 'Standard', 'Product']
        OPTIONAL MATCH (statement:Statement {userId: $userId, workspaceId: $workspaceId})-[:HAS_SUBJECT|HAS_OBJECT]->(e)
        RETURN e.uuid as uuid, e.name as name, e.type as type, e.attributes as attributes, count(statement) as weight
        ORDER BY weight DESC, name ASC
        LIMIT 10
      `,
      { userId, workspaceId },
    ) as Promise<Array<{ get: (key: string) => unknown }>>,
  ]);

  const trendMap = new Map<string, { date: string; proposed: number; accepted: number }>();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    trendMap.set(key, { date: key, proposed: 0, accepted: 0 });
  }
  for (const item of proposedItems) {
    const key = item.createdAt.toISOString().slice(0, 10);
    const bucket = trendMap.get(key);
    if (!bucket) continue;
    bucket.proposed += 1;
    if (item.status === "ACCEPTED" || item.status === "MERGED") {
      bucket.accepted += 1;
    }
  }

  return {
    reviewQueue: {
      count: reviewQueueCount,
      batchesCount: recentBatches.length,
    },
    recentGrowth: recentAcceptedItems.map(summarizeCaptureItem),
    recentBatches: recentBatches.map((batch) => summarizeBatch(batch as KnowledgeCaptureBatchWithItems)),
    activeProjects: projectRows.map((row) => ({
      id: toKnowledgeObjectId("entity", String(row.get("uuid") ?? "")),
      title: String(row.get("name") ?? ""),
      type: String(row.get("type") ?? "Project"),
      weight:
        typeof row.get("weight") === "object" &&
        row.get("weight") &&
        "toNumber" in (row.get("weight") as Record<string, unknown>)
          ? (row.get("weight") as { toNumber: () => number }).toNumber()
          : Number(row.get("weight") ?? 0),
    })),
    activeTopics: topicRows.map((row) => ({
      id: toKnowledgeObjectId("entity", String(row.get("uuid") ?? "")),
      title: String(row.get("name") ?? ""),
      type: String(row.get("type") ?? "Concept"),
      weight:
        typeof row.get("weight") === "object" &&
        row.get("weight") &&
        "toNumber" in (row.get("weight") as Record<string, unknown>)
          ? (row.get("weight") as { toNumber: () => number }).toNumber()
          : Number(row.get("weight") ?? 0),
    })),
    recentEvents: eventItems.map(summarizeCaptureItem),
    recentDecisions: decisionItems.map(summarizeCaptureItem),
    learningTrend: Array.from(trendMap.values()),
  };
}

function parseKnowledgeObjectId(objectId: string) {
  if (objectId.startsWith("entity:")) {
    return { kind: "entity" as const, uuid: objectId.slice("entity:".length) };
  }
  if (objectId.startsWith("statement:")) {
    return { kind: "statement" as const, uuid: objectId.slice("statement:".length) };
  }
  throw new Error("Invalid knowledge object id.");
}

async function buildEntityObjectDetail(uuid: string, userId: string, workspaceId: string) {
  const graphProvider = ProviderFactory.getGraphProvider();
  const entity = await graphProvider.getEntity(uuid, userId, workspaceId);
  if (!entity) {
    throw new Error("Knowledge object not found.");
  }
  const entityAttributes = entity.attributes ?? {};
  const stableDefinition =
    typeof entityAttributes.definition === "string" && entityAttributes.definition.trim()
      ? entityAttributes.definition.trim()
      : "待补充解释";
  const aliases = normalizeStringList(entityAttributes.aliases, entity.name);

  const relatedRecords = (await graphProvider.runQuery(
    `
      MATCH (statement:Statement {userId: $userId})
      WHERE statement.invalidAt IS NULL
        AND ($workspaceId IS NULL OR statement.workspaceId = $workspaceId)
      MATCH (statement)-[:HAS_SUBJECT]->(source:Entity {userId: $userId})
      WHERE ($workspaceId IS NULL OR source.workspaceId = $workspaceId)
      MATCH (statement)-[:HAS_PREDICATE]->(predicate:Entity {userId: $userId})
      WHERE ($workspaceId IS NULL OR predicate.workspaceId = $workspaceId)
      MATCH (statement)-[:HAS_OBJECT]->(target:Entity {userId: $userId})
      WHERE ($workspaceId IS NULL OR target.workspaceId = $workspaceId)
      OPTIONAL MATCH (episode:Episode {userId: $userId})-[:HAS_PROVENANCE]->(statement)
      WHERE ($workspaceId IS NULL OR episode.workspaceId = $workspaceId)
      WITH statement, source, predicate, target, collect(DISTINCT episode.uuid)[0..6] AS episodeUuids
      WHERE source.uuid = $uuid OR target.uuid = $uuid OR predicate.uuid = $uuid
      RETURN
        statement.uuid AS statementUuid,
        statement.fact AS fact,
        statement.aspect AS aspect,
        statement.createdAt AS createdAt,
        statement.validAt AS validAt,
        statement.attributes AS attributes,
        source.uuid AS sourceUuid,
        source.name AS sourceName,
        source.type AS sourceType,
        target.uuid AS targetUuid,
        target.name AS targetName,
        target.type AS targetType,
        predicate.name AS predicateName,
        episodeUuids
      ORDER BY coalesce(statement.validAt, statement.createdAt) DESC
      LIMIT 30
    `,
    { uuid, userId, workspaceId },
  )) as Array<{ get: (key: string) => unknown }>;

  const relatedStatements = relatedRecords.map((record) => ({
    id: toKnowledgeObjectId("statement", String(record.get("statementUuid") ?? "")),
    uuid: String(record.get("statementUuid") ?? ""),
    title: String(record.get("fact") ?? ""),
    aspect: (record.get("aspect") as string | null | undefined) ?? null,
    createdAt: String(record.get("createdAt") ?? ""),
    validAt: String(record.get("validAt") ?? ""),
    predicate: String(record.get("predicateName") ?? ""),
    source: {
      uuid: String(record.get("sourceUuid") ?? ""),
      name: String(record.get("sourceName") ?? ""),
      type: String(record.get("sourceType") ?? "Concept"),
    },
    target: {
      uuid: String(record.get("targetUuid") ?? ""),
      name: String(record.get("targetName") ?? ""),
      type: String(record.get("targetType") ?? "Concept"),
    },
    attributes:
      typeof record.get("attributes") === "object" && record.get("attributes")
        ? (record.get("attributes") as Record<string, unknown>)
        : {},
    episodeUuids: Array.isArray(record.get("episodeUuids"))
      ? (record.get("episodeUuids") as unknown[]).map(String)
      : [],
  }));
  const relatedStatementUuids = relatedStatements.map((statement) => statement.uuid).filter(Boolean);

  const evidenceItems = await prisma.knowledgeCaptureItem.findMany({
    where: {
      userId,
      workspaceId,
      OR: [
        { acceptedGraphUuid: uuid },
        { mergeTargetUuid: uuid },
        ...(relatedStatementUuids.length > 0
          ? [{ acceptedGraphUuid: { in: relatedStatementUuids } }]
          : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  const relatedProjects = relatedStatements
    .flatMap((statement) => [statement.source, statement.target])
    .filter((candidate) => candidate.type === "Project")
    .reduce<Array<{ uuid: string; name: string }>>((acc, project) => {
      if (!acc.find((item) => item.uuid === project.uuid)) {
        acc.push({ uuid: project.uuid, name: project.name });
      }
      return acc;
    }, []);
  const relatedTerms = relatedStatements
    .flatMap((statement) => [
      { ...statement.source, predicate: statement.predicate },
      { ...statement.target, predicate: statement.predicate },
    ])
    .filter(
      (candidate) =>
        candidate.uuid &&
        candidate.uuid !== entity.uuid &&
        candidate.type !== "Predicate",
    )
    .reduce<Array<{ id: string; uuid: string; name: string; type: string; predicate: string }>>(
      (acc, term) => {
        if (!acc.find((item) => item.uuid === term.uuid)) {
          acc.push({
            id: toKnowledgeObjectId("entity", term.uuid),
            uuid: term.uuid,
            name: term.name,
            type: term.type,
            predicate: term.predicate,
          });
        }
        return acc;
      },
      [],
    );

  return {
    object: {
      id: toKnowledgeObjectId("entity", entity.uuid),
      uuid: entity.uuid,
      kind: "entity",
      title: entity.name,
      type: entity.type ?? "Concept",
      summary: stableDefinition,
      aliases,
      attributes: entityAttributes,
      createdAt: entity.createdAt.toISOString(),
      firstSeenAt:
        typeof entityAttributes.firstSeenAt === "string"
          ? entityAttributes.firstSeenAt
          : entity.createdAt.toISOString(),
      lastSeenAt:
        typeof entityAttributes.lastSeenAt === "string"
          ? entityAttributes.lastSeenAt
          : entity.createdAt.toISOString(),
      lastReviewedAt:
        typeof entityAttributes.lastReviewedAt === "string"
          ? entityAttributes.lastReviewedAt
          : null,
      confidence:
        typeof entityAttributes.confidence === "number" ? entityAttributes.confidence : null,
      evidenceCount: evidenceItems.length,
      relationCount: relatedStatements.length,
      relatedProjects,
      relatedTerms,
      timeline: relatedStatements.map((statement) => ({
        id: statement.uuid,
        title: statement.title,
        aspect: statement.aspect,
        createdAt: statement.createdAt,
      })),
      evidence: evidenceItems.map(summarizeCaptureItem),
      statements: relatedStatements,
    },
  };
}

async function buildStatementObjectDetail(uuid: string, userId: string, workspaceId: string) {
  const graphProvider = ProviderFactory.getGraphProvider();
  const records = (await graphProvider.runQuery(
    `
      MATCH (statement:Statement {uuid: $uuid, userId: $userId})
      WHERE statement.invalidAt IS NULL
        AND ($workspaceId IS NULL OR statement.workspaceId = $workspaceId)
      MATCH (statement)-[:HAS_SUBJECT]->(source:Entity {userId: $userId})
      MATCH (statement)-[:HAS_PREDICATE]->(predicate:Entity {userId: $userId})
      MATCH (statement)-[:HAS_OBJECT]->(target:Entity {userId: $userId})
      OPTIONAL MATCH (episode:Episode {userId: $userId})-[:HAS_PROVENANCE]->(statement)
      RETURN
        statement.uuid AS statementUuid,
        statement.fact AS fact,
        statement.aspect AS aspect,
        statement.createdAt AS createdAt,
        statement.validAt AS validAt,
        statement.attributes AS attributes,
        source.uuid AS sourceUuid,
        source.name AS sourceName,
        source.type AS sourceType,
        target.uuid AS targetUuid,
        target.name AS targetName,
        target.type AS targetType,
        predicate.name AS predicateName,
        collect(DISTINCT episode.uuid)[0..6] AS episodeUuids
      LIMIT 1
    `,
    { uuid, userId, workspaceId },
  )) as Array<{ get: (key: string) => unknown }>;

  const record = records[0];
  if (!record) {
    throw new Error("Knowledge object not found.");
  }

  const attributes =
    typeof record.get("attributes") === "object" && record.get("attributes")
      ? (record.get("attributes") as Record<string, unknown>)
      : {};

  const evidenceItems = await prisma.knowledgeCaptureItem.findMany({
    where: {
      userId,
      workspaceId,
      acceptedGraphUuid: uuid,
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  return {
    object: {
      id: toKnowledgeObjectId("statement", uuid),
      uuid,
      kind: "statement",
      title: String(record.get("fact") ?? ""),
      type: (record.get("aspect") as string | null | undefined) ?? "Knowledge",
      summary: String(record.get("fact") ?? ""),
      aliases: [],
      attributes,
      createdAt: String(record.get("createdAt") ?? ""),
      firstSeenAt:
        typeof attributes.firstSeenAt === "string"
          ? attributes.firstSeenAt
          : String(record.get("createdAt") ?? ""),
      lastSeenAt:
        typeof attributes.lastSeenAt === "string"
          ? attributes.lastSeenAt
          : String(record.get("createdAt") ?? ""),
      lastReviewedAt: evidenceItems[0]?.lastReviewedAt?.toISOString() ?? null,
      confidence: typeof attributes.confidence === "number" ? attributes.confidence : null,
      evidenceCount: evidenceItems.length,
      relationCount: 1,
      relatedProjects: [record.get("sourceType"), record.get("targetType")]
        .map((value, index) => {
          const type = String(value ?? "");
          if (type !== "Project") return null;
          return {
            uuid:
              index === 0
                ? String(record.get("sourceUuid") ?? "")
                : String(record.get("targetUuid") ?? ""),
            name:
              index === 0
                ? String(record.get("sourceName") ?? "")
                : String(record.get("targetName") ?? ""),
          };
        })
        .filter(Boolean),
      relatedTerms: [
        {
          id: toKnowledgeObjectId("entity", String(record.get("sourceUuid") ?? "")),
          uuid: String(record.get("sourceUuid") ?? ""),
          name: String(record.get("sourceName") ?? ""),
          type: String(record.get("sourceType") ?? "Concept"),
          predicate: String(record.get("predicateName") ?? ""),
        },
        {
          id: toKnowledgeObjectId("entity", String(record.get("targetUuid") ?? "")),
          uuid: String(record.get("targetUuid") ?? ""),
          name: String(record.get("targetName") ?? ""),
          type: String(record.get("targetType") ?? "Concept"),
          predicate: String(record.get("predicateName") ?? ""),
        },
      ].filter((term) => term.uuid),
      timeline: [
        {
          id: uuid,
          title: String(record.get("fact") ?? ""),
          aspect: (record.get("aspect") as string | null | undefined) ?? null,
          createdAt: String(record.get("createdAt") ?? ""),
        },
      ],
      evidence: evidenceItems.map(summarizeCaptureItem),
      statements: [
        {
          id: toKnowledgeObjectId("statement", uuid),
          uuid,
          title: String(record.get("fact") ?? ""),
          aspect: (record.get("aspect") as string | null | undefined) ?? null,
          createdAt: String(record.get("createdAt") ?? ""),
          validAt: String(record.get("validAt") ?? ""),
          predicate: String(record.get("predicateName") ?? ""),
          source: {
            uuid: String(record.get("sourceUuid") ?? ""),
            name: String(record.get("sourceName") ?? ""),
            type: String(record.get("sourceType") ?? "Concept"),
          },
          target: {
            uuid: String(record.get("targetUuid") ?? ""),
            name: String(record.get("targetName") ?? ""),
            type: String(record.get("targetType") ?? "Concept"),
          },
          attributes,
          episodeUuids: Array.isArray(record.get("episodeUuids"))
            ? (record.get("episodeUuids") as unknown[]).map(String)
            : [],
        },
      ],
    },
  };
}

export async function getKnowledgeObjectDetail(objectId: string, userId: string, workspaceId: string) {
  const parsed = parseKnowledgeObjectId(objectId);
  if (parsed.kind === "entity") {
    return buildEntityObjectDetail(parsed.uuid, userId, workspaceId);
  }
  return buildStatementObjectDetail(parsed.uuid, userId, workspaceId);
}

export async function getKnowledgeObjectGraph(
  objectId: string,
  userId: string,
  workspaceId: string,
  depth = 1,
  limit = 40,
) {
  const parsed = parseKnowledgeObjectId(objectId);
  const graphProvider = ProviderFactory.getGraphProvider();

  if (parsed.kind === "statement") {
    const detail = await buildStatementObjectDetail(parsed.uuid, userId, workspaceId);
    const statement = detail.object.statements[0];
    return {
      centerId: statement.id,
      nodes: [
        {
          id: statement.source.uuid,
          label: statement.source.name,
          type: statement.source.type,
          primary: true,
        },
        {
          id: statement.target.uuid,
          label: statement.target.name,
          type: statement.target.type,
          primary: true,
        },
      ],
      edges: [
        {
          id: statement.uuid,
          source: statement.source.uuid,
          target: statement.target.uuid,
          label: statement.predicate,
          weight: 1,
          aspect: statement.aspect,
        },
      ],
      meta: {
        depth: 1,
        truncated: false,
      },
    };
  }

  const entityDetail = await buildEntityObjectDetail(parsed.uuid, userId, workspaceId);
  const seedIds = new Set<string>([parsed.uuid]);
  for (const statement of entityDetail.object.statements) {
    seedIds.add(statement.source.uuid);
    seedIds.add(statement.target.uuid);
  }

  const queryIds = depth > 1 ? Array.from(seedIds) : [parsed.uuid];

  const records = (await graphProvider.runQuery(
    `
      MATCH (statement:Statement {userId: $userId})
      WHERE statement.invalidAt IS NULL
        AND ($workspaceId IS NULL OR statement.workspaceId = $workspaceId)
      MATCH (statement)-[:HAS_SUBJECT]->(source:Entity {userId: $userId})
      WHERE ($workspaceId IS NULL OR source.workspaceId = $workspaceId)
      MATCH (statement)-[:HAS_PREDICATE]->(predicate:Entity {userId: $userId})
      WHERE ($workspaceId IS NULL OR predicate.workspaceId = $workspaceId)
      MATCH (statement)-[:HAS_OBJECT]->(target:Entity {userId: $userId})
      WHERE ($workspaceId IS NULL OR target.workspaceId = $workspaceId)
      WITH statement, source, predicate, target
      WHERE source.uuid IN $queryIds OR target.uuid IN $queryIds
      RETURN
        statement.uuid AS statementUuid,
        predicate.name AS predicateName,
        statement.aspect AS aspect,
        source.uuid AS sourceUuid,
        source.name AS sourceName,
        source.type AS sourceType,
        target.uuid AS targetUuid,
        target.name AS targetName,
        target.type AS targetType
      ORDER BY coalesce(statement.validAt, statement.createdAt) DESC
      LIMIT ${Math.min(80, limit * 2)}
    `,
    {
      userId,
      workspaceId,
      queryIds,
    },
  )) as Array<{ get: (key: string) => unknown }>;

  const nodeMap = new Map<
    string,
    {
      id: string;
      label: string;
      type: string;
      primary: boolean;
    }
  >();

  const edges = records.map((record) => {
    const sourceUuid = String(record.get("sourceUuid") ?? "");
    const targetUuid = String(record.get("targetUuid") ?? "");

    nodeMap.set(sourceUuid, {
      id: sourceUuid,
      label: String(record.get("sourceName") ?? ""),
      type: String(record.get("sourceType") ?? "Concept"),
      primary: sourceUuid === parsed.uuid || queryIds.includes(sourceUuid),
    });
    nodeMap.set(targetUuid, {
      id: targetUuid,
      label: String(record.get("targetName") ?? ""),
      type: String(record.get("targetType") ?? "Concept"),
      primary: targetUuid === parsed.uuid || queryIds.includes(targetUuid),
    });

    return {
      id: String(record.get("statementUuid") ?? ""),
      source: sourceUuid,
      target: targetUuid,
      label: String(record.get("predicateName") ?? "related_to"),
      weight: 1,
      aspect: (record.get("aspect") as string | null | undefined) ?? null,
    };
  });

  const nodes = Array.from(nodeMap.values()).slice(0, limit);
  const allowedIds = new Set(nodes.map((node) => node.id));

  return {
    centerId: parsed.uuid,
    nodes,
    edges: edges.filter((edge) => allowedIds.has(edge.source) && allowedIds.has(edge.target)).slice(0, limit * 2),
    meta: {
      depth,
      truncated: nodeMap.size > limit,
    },
  };
}

export async function searchKnowledgeObjects(query: string, userId: string, workspaceId: string) {
  const term = query.trim();
  if (!term) {
    return { results: [] };
  }

  const graphProvider = ProviderFactory.getGraphProvider();
  const entityRows = (await graphProvider.runQuery(
    `
      MATCH (entity:Entity {userId: $userId})
      WHERE ($workspaceId IS NULL OR entity.workspaceId = $workspaceId)
        AND toLower(entity.name) CONTAINS toLower($term)
      RETURN entity.uuid AS uuid, entity.name AS name, entity.type AS type, entity.attributes AS attributes
      ORDER BY entity.name ASC
      LIMIT 12
    `,
    { userId, workspaceId, term },
  )) as Array<{ get: (key: string) => unknown }>;

  const statementItems = await prisma.knowledgeCaptureItem.findMany({
    where: {
      userId,
      workspaceId,
      status: "ACCEPTED",
      kind: { in: ["EVENT", "DECISION"] },
      title: {
        contains: term,
        mode: "insensitive",
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return {
    results: [
      ...entityRows.map((row) => ({
        id: toKnowledgeObjectId("entity", String(row.get("uuid") ?? "")),
        title: String(row.get("name") ?? ""),
        type: String(row.get("type") ?? "Concept"),
        kind: "entity",
      })),
      ...statementItems.map((item) => ({
        id: item.acceptedGraphUuid
          ? toKnowledgeObjectId("statement", item.acceptedGraphUuid)
          : item.id,
        title: item.title,
        type: item.kind === "EVENT" ? "Event" : "Decision",
        kind: "statement",
      })),
    ],
  };
}
