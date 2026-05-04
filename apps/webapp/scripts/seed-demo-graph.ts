import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import type {
  EntityNode,
  EpisodicNode,
  StatementNode,
  Triple,
  EntityType,
  StatementAspect,
} from "@core/types";

type DemoTripleInput = {
  subject: { name: string; type: EntityType };
  predicate: { name: string };
  object: { name: string; type: EntityType };
  fact: string;
  aspect: StatementAspect;
};

type CliOptions = {
  reset: boolean;
  limit?: number;
};

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
const { ProviderFactory } = require("@core/providers") as typeof import("@core/providers");
const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadRepoEnv() {
  const repoRoot = path.resolve(__dirname, "../../..");
  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, "packages/database/.env"));
  loadEnvFile(path.join(repoRoot, "apps/webapp/.env"));
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function stableId(prefix: string, value: string) {
  const hash = crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
  return `demo:${prefix}:${hash}`;
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = { reset: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--reset") {
      options.reset = true;
      continue;
    }

    if (arg === "--limit") {
      const rawValue = argv[index + 1];
      const parsed = Number.parseInt(rawValue ?? "", 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed;
        index += 1;
      }
    }
  }

  return options;
}

function makeEntity(name: string, type: EntityType, userId: string, workspaceId: string): EntityNode {
  return {
    uuid: stableId(`entity:${type}`, `${type}:${name}`),
    name,
    type,
    createdAt: new Date("2026-05-02T00:00:00.000Z"),
    userId,
    workspaceId,
    attributes: {
      sourceMode: "demo-seed",
    },
  };
}

function makeStatement(
  fact: string,
  aspect: StatementAspect,
  userId: string,
  workspaceId: string,
): StatementNode {
  return {
    uuid: stableId("statement", fact),
    fact,
    factEmbedding: [],
    createdAt: new Date("2026-05-02T00:00:00.000Z"),
    validAt: new Date("2026-05-02T00:00:00.000Z"),
    invalidAt: null,
    attributes: {
      sourceMode: "demo-seed",
    },
    userId,
    workspaceId,
    aspect,
    provenanceCount: 1,
  };
}

function makeEpisode(userId: string, workspaceId: string, content: string): EpisodicNode {
  return {
    uuid: "demo:episode:knowledge-platform",
    content,
    originalContent: content,
    metadata: {
      sourceMode: "demo-seed",
    },
    source: "demo",
    createdAt: new Date("2026-05-02T00:00:00.000Z"),
    validAt: new Date("2026-05-02T00:00:00.000Z"),
    labelIds: [],
    userId,
    workspaceId,
    sessionId: "demo-knowledge-platform",
    queueId: "demo-knowledge-platform",
    type: "CONVERSATION",
    contentEmbedding: [],
  };
}

function buildDemoTriples(
  userId: string,
  workspaceId: string,
  episode: EpisodicNode,
  limit?: number,
): Triple[] {
  const inputs: DemoTripleInput[] = [
    {
      subject: { name: "MemoryNote", type: "Project" },
      predicate: { name: "focuses_on" },
      object: { name: "个人知识体系搭建", type: "Concept" },
      fact: "MemoryNote focuses on personal knowledge system building.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "Vue 3", type: "Technology" },
      predicate: { name: "is_suited_for" },
      object: { name: "知识图谱前端", type: "Concept" },
      fact: "Vue 3 is suited for the knowledge graph frontend.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "Neo4j", type: "Technology" },
      predicate: { name: "stores" },
      object: { name: "实体关系", type: "Concept" },
      fact: "Neo4j stores entity relationships for the graph.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "pgvector", type: "Technology" },
      predicate: { name: "powers" },
      object: { name: "语义检索", type: "Concept" },
      fact: "pgvector powers semantic retrieval.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "OpenAI-compatible 接口", type: "Standard" },
      predicate: { name: "supports" },
      object: { name: "自定义 baseUrl", type: "Concept" },
      fact: "OpenAI-compatible endpoints support custom baseUrl configuration.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "OpenAI-compatible 接口", type: "Standard" },
      predicate: { name: "powers" },
      object: { name: "AI助手", type: "Product" },
      fact: "OpenAI-compatible endpoints power the AI assistant.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "qwen3-embedding-4b", type: "Technology" },
      predicate: { name: "handles" },
      object: { name: "嵌入向量生成", type: "Concept" },
      fact: "qwen3-embedding-4b handles embedding vector generation.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "qwen3-embedding-4b", type: "Technology" },
      predicate: { name: "powers" },
      object: { name: "语义检索", type: "Concept" },
      fact: "qwen3-embedding-4b powers semantic search.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "qwen3-reranker-4b", type: "Technology" },
      predicate: { name: "handles" },
      object: { name: "结果重排序", type: "Concept" },
      fact: "qwen3-reranker-4b handles result reranking.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "qwen3-reranker-4b", type: "Technology" },
      predicate: { name: "improves" },
      object: { name: "相关笔记", type: "Concept" },
      fact: "qwen3-reranker-4b improves related-note ranking.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "TypeScript", type: "Technology" },
      predicate: { name: "improves" },
      object: { name: "服务层约束", type: "Concept" },
      fact: "TypeScript improves service-layer constraints.",
      aspect: "Decision",
    },
    {
      subject: { name: "聊天内容", type: "Concept" },
      predicate: { name: "can_extractor" },
      object: { name: "知识三元组", type: "Concept" },
      fact: "Chat content can be extracted into knowledge triples.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "3D 图谱", type: "Concept" },
      predicate: { name: "enhances" },
      object: { name: "知识具象化展示", type: "Concept" },
      fact: "3D graph enhances the visualization of knowledge structure.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "MemoryNote", type: "Project" },
      predicate: { name: "supports" },
      object: { name: "个人成长", type: "Concept" },
      fact: "MemoryNote supports personal growth.",
      aspect: "Goal",
    },
    {
      subject: { name: "个人知识体系搭建", type: "Concept" },
      predicate: { name: "includes" },
      object: { name: "编程技术", type: "Concept" },
      fact: "Personal knowledge building includes programming knowledge.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "个人知识体系搭建", type: "Concept" },
      predicate: { name: "includes" },
      object: { name: "个人成长", type: "Concept" },
      fact: "Personal knowledge building includes personal growth.",
      aspect: "Goal",
    },
    {
      subject: { name: "个人知识体系搭建", type: "Concept" },
      predicate: { name: "includes" },
      object: { name: "人和物", type: "Concept" },
      fact: "Personal knowledge building includes people and things.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "编程技术", type: "Concept" },
      predicate: { name: "covers" },
      object: { name: "Vue 3", type: "Technology" },
      fact: "Programming knowledge covers Vue 3.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "编程技术", type: "Concept" },
      predicate: { name: "covers" },
      object: { name: "TypeScript", type: "Technology" },
      fact: "Programming knowledge covers TypeScript.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "编程技术", type: "Concept" },
      predicate: { name: "covers" },
      object: { name: "Neo4j", type: "Technology" },
      fact: "Programming knowledge covers Neo4j.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "聊天内容", type: "Concept" },
      predicate: { name: "generates" },
      object: { name: "知识三元组", type: "Concept" },
      fact: "Chat content generates knowledge triples.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "知识三元组", type: "Concept" },
      predicate: { name: "stored_in" },
      object: { name: "Neo4j", type: "Technology" },
      fact: "Knowledge triples are stored in Neo4j.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "Neo4j", type: "Technology" },
      predicate: { name: "powers" },
      object: { name: "知识图谱", type: "Concept" },
      fact: "Neo4j powers the knowledge graph.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "知识图谱", type: "Concept" },
      predicate: { name: "has_mode" },
      object: { name: "2D 图谱", type: "Concept" },
      fact: "The knowledge graph has a 2D visualization mode.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "知识图谱", type: "Concept" },
      predicate: { name: "has_mode" },
      object: { name: "3D 图谱", type: "Concept" },
      fact: "The knowledge graph has a 3D visualization mode.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "知识图谱", type: "Concept" },
      predicate: { name: "links_with" },
      object: { name: "pgvector", type: "Technology" },
      fact: "The knowledge graph links with pgvector for semantic search.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "pgvector", type: "Technology" },
      predicate: { name: "supports" },
      object: { name: "语义检索", type: "Concept" },
      fact: "pgvector supports semantic search.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "语义检索", type: "Concept" },
      predicate: { name: "helps" },
      object: { name: "相关笔记", type: "Concept" },
      fact: "Semantic search helps find related notes.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "相关笔记", type: "Concept" },
      predicate: { name: "supports" },
      object: { name: "个人成长", type: "Concept" },
      fact: "Related notes support personal growth.",
      aspect: "Goal",
    },
    {
      subject: { name: "Vue 3", type: "Technology" },
      predicate: { name: "renders" },
      object: { name: "图谱页面", type: "Concept" },
      fact: "Vue 3 renders the graph page.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "图谱页面", type: "Concept" },
      predicate: { name: "uses" },
      object: { name: "2D 图谱", type: "Concept" },
      fact: "The graph page uses the 2D visualization.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "图谱页面", type: "Concept" },
      predicate: { name: "uses" },
      object: { name: "3D 图谱", type: "Concept" },
      fact: "The graph page uses the 3D visualization.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "用户", type: "Person" },
      predicate: { name: "chats_with" },
      object: { name: "AI助手", type: "Product" },
      fact: "The user chats with the AI assistant.",
      aspect: "Relationship",
    },
    {
      subject: { name: "AI助手", type: "Product" },
      predicate: { name: "extracts" },
      object: { name: "知识关键词", type: "Concept" },
      fact: "The AI assistant extracts knowledge keywords.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "AI助手", type: "Product" },
      predicate: { name: "handles" },
      object: { name: "聊天内容", type: "Concept" },
      fact: "The AI assistant handles chat content.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "知识关键词", type: "Concept" },
      predicate: { name: "become" },
      object: { name: "实体", type: "Concept" },
      fact: "Knowledge keywords become entities.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "实体", type: "Concept" },
      predicate: { name: "link_with" },
      object: { name: "关系", type: "Concept" },
      fact: "Entities connect through relationships.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "关系", type: "Concept" },
      predicate: { name: "form" },
      object: { name: "知识结构", type: "Concept" },
      fact: "Relationships form the knowledge structure.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "知识积累", type: "Concept" },
      predicate: { name: "comes_from" },
      object: { name: "笔记", type: "Concept" },
      fact: "Knowledge accumulation comes from notes.",
      aspect: "Knowledge",
    },
    {
      subject: { name: "笔记", type: "Concept" },
      predicate: { name: "captures" },
      object: { name: "编程技术", type: "Concept" },
      fact: "Notes capture programming knowledge.",
      aspect: "Knowledge",
    },
  ];

  const selectedInputs = typeof limit === "number" ? inputs.slice(0, limit) : inputs;

  return selectedInputs.map((item) => {
    const fact = item.fact || `${item.subject.name} ${item.predicate.name} ${item.object.name}`;
    return {
      statement: makeStatement(fact, item.aspect, userId, workspaceId),
      subject: makeEntity(item.subject.name, item.subject.type, userId, workspaceId),
      predicate: makeEntity(item.predicate.name, "Predicate", userId, workspaceId),
      object: makeEntity(item.object.name, item.object.type, userId, workspaceId),
      provenance: episode,
    };
  });
}

async function main() {
  loadRepoEnv();
  const options = parseCliOptions(process.argv.slice(2));

  const membership = await prisma.userWorkspace.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      user: true,
      workspace: true,
    },
  });

  if (!membership) {
    throw new Error("No active workspace membership found.");
  }

  const userId = membership.userId;
  const workspaceId = membership.workspaceId;

  ProviderFactory.initializeFromEnv({ prisma });
  await ProviderFactory.initializeSchemaOnce();

  const graphProvider = ProviderFactory.getGraphProvider();

  if (options.reset) {
    await graphProvider.deleteUser(userId);
    console.log(`Cleared all graph data for user ${userId}`);
  }

  const seedEpisode = makeEpisode(
    userId,
    workspaceId,
    "Demo knowledge graph seed data for MemoryNote.",
  );
  await graphProvider.saveEpisode(seedEpisode);

  const demoTriples = buildDemoTriples(userId, workspaceId, seedEpisode, options.limit);
  let created = 0;

  for (const triple of demoTriples) {
    await graphProvider.saveTriple({
      statement: triple.statement,
      subject: triple.subject,
      predicate: triple.predicate,
      object: triple.object,
      episodeUuid: seedEpisode.uuid,
      userId,
      workspaceId,
    });
    created += 1;
  }

  console.log(
    `Seeded ${created} demo triples for user ${userId} / workspace ${workspaceId} (${membership.user.email ?? "unknown"})`,
  );
  console.log("Demo episode:", seedEpisode.uuid);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await ProviderFactory.closeAll().catch(() => {});
  });
