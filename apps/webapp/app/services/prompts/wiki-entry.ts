/**
 * Wiki Entry Prompt
 *
 * Generates wiki entries for entities using LLM.
 * Creates structured documentation: title, definition, summary, and detailed content.
 */

import { type ModelMessage } from "ai";
import { z } from "zod";

/**
 * Schema for wiki entry generation
 */
export const WikiEntrySchema = z.object({
  title: z.string().describe("词条标题，通常是实体名称"),
  definition: z.string().describe("简短定义，1-2句话，清晰说明这个概念是什么"),
  summary: z.string().describe("摘要，3-5句话，概述这个概念的重要信息"),
  content: z
    .string()
    .describe("详细解释，Markdown 格式，包含背景、特点、应用场景等"),
});

export type WikiEntryGenerated = z.infer<typeof WikiEntrySchema>;

/**
 * Parameters for generating a wiki entry prompt
 */
export interface WikiEntryPromptParams {
  entityName: string;
  entityType?: string;
  statements: Array<{
    fact: string;
    aspect: string | null;
    validAt: Date;
  }>;
  episodes: Array<{
    content: string;
    source: string;
    createdAt: Date;
  }>;
}

/**
 * Generates a prompt for creating wiki entries
 *
 * @param params - Entity name, type, related statements, and episodes
 * @returns Array of ModelMessage for LLM
 */
export function generateWikiEntryPrompt(
  params: WikiEntryPromptParams,
): ModelMessage[] {
  const { entityName, entityType, statements, episodes } = params;

  const sysPrompt = `你是一个知识管理助手，负责为实体创建百科词条。你的任务是根据提供的事实和对话/文档片段，生成结构化的词条内容。

## 词条结构

每个词条包含以下部分：

1. **标题**：实体名称，简洁明了
2. **定义**：1-2句话，清晰说明这个概念/实体是什么
3. **摘要**：3-5句话，概述这个概念/实体的重要信息，包括关键特征和核心价值
4. **详细解释**：Markdown 格式的详细内容，包括：
   - 背景介绍
   - 主要特点
   - 应用场景
   - 相关信息

## 写作原则

1. **准确性**：基于提供的事实和上下文，不编造信息
2. **简洁性**：定义和摘要要精炼，避免冗余
3. **实用性**：突出对用户有价值的信息
4. **结构化**：详细解释要有清晰的层次结构
5. **客观性**：以客观、中立的语气描述

## 格式要求

- 定义：纯文本，1-2句话
- 摘要：纯文本，3-5句话
- 详细解释：Markdown 格式，使用标题、列表、段落等结构化元素

## 注意事项

- 如果提供的信息不足以生成完整词条，基于已有信息生成，不要编造
- 保持信息的时效性，注意事实的有效日期
- 如果存在多个相关事实，整合为连贯的叙述
- 突出与用户相关的重要信息`;

  // Build statements section
  const statementsSection =
    statements.length > 0
      ? `<related_facts>
${statements
  .map((s, i) => {
    const aspectLabel = s.aspect ? `[${s.aspect}]` : "";
    const dateLabel = s.validAt
      ? `(${new Date(s.validAt).toLocaleDateString("zh-CN")})`
      : "";
    return `${i + 1}. ${aspectLabel} ${s.fact} ${dateLabel}`;
  })
  .join("\n")}
</related_facts>`
      : "";

  // Build episodes section
  const episodesSection =
    episodes.length > 0
      ? `<context_sources>
${episodes
  .map((e, i) => {
    const dateLabel = e.createdAt
      ? ` (${new Date(e.createdAt).toLocaleDateString("zh-CN")})`
      : "";
    return `[来源: ${e.source}${dateLabel}]
${e.content}`;
  })
  .join("\n\n")}
</context_sources>`
      : "";

  // Build entity info
  const entityInfo = entityType
    ? `实体名称：${entityName}\n实体类型：${entityType}`
    : `实体名称：${entityName}`;

  const userPrompt = `请为以下实体创建百科词条：

${entityInfo}

${statementsSection}

${episodesSection}

请生成结构化的词条内容，包括标题、定义、摘要和详细解释。`;

  return [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];
}
