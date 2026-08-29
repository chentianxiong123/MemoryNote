import { z } from "zod";
import { isValidDatabaseUrl } from "./utils/db";
import { LLMModelEnum } from "@core/types";

const EnvironmentSchema = z
  .object({
    NODE_ENV: z.union([
      z.literal("development"),
      z.literal("production"),
      z.literal("test"),
    ]),
    POSTGRES_DB: z.string(),
    DATABASE_URL: z
      .string()
      .refine(
        isValidDatabaseUrl,
        "DATABASE_URL is invalid, for details please check the additional output above this message.",
      ),
    DATABASE_CONNECTION_LIMIT: z.coerce.number().int().default(10),
    DATABASE_POOL_TIMEOUT: z.coerce.number().int().default(60),
    DATABASE_CONNECTION_TIMEOUT: z.coerce.number().int().default(20),
    DIRECT_URL: z
      .string()
      .refine(
        isValidDatabaseUrl,
        "DIRECT_URL is invalid, for details please check the additional output above this message.",
      ),
    DATABASE_READ_REPLICA_URL: z.string().optional(),

    APP_ENV: z.string().default(process.env.NODE_ENV),
    LOGIN_ORIGIN: z.string().default("http://localhost:5173"),
    APP_ORIGIN: z.string().default("http://localhost:5173"),

    // Neo4j
    NEO4J_URI: z.string(),
    NEO4J_USERNAME: z.string(),
    NEO4J_PASSWORD: z.string(),

    // OpenAI
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z
      .string()
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val : undefined)),
    OPENAI_API_MODE: z
      .enum(["responses", "chat_completions", "chat"])
      .default("responses"),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
    AI_GATEWAY_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    MISTRAL_API_KEY: z.string().optional(),
    XAI_API_KEY: z.string().optional(),
    AZURE_API_KEY: z.string().optional(),
    AZURE_BASE_URL: z.string().optional(),

    // Model envs
    MODEL: z.string().default(LLMModelEnum.GPT41),
    EMBEDDING_MODEL: z.string().default("mxbai-embed-large"),
    EMBEDDING_MODEL_SIZE: z.string().default("1024"),
    EMBEDDING_API_KEY: z.string().optional(),
    MODEL_TEMPERATURE: z.coerce.number().default(1),
    LLM_TOLERANT_OUTPUT: z.string().optional(),
    OLLAMA_URL: z.string().optional(),
    CHAT_PROVIDER: z
      .enum(["openai", "anthropic", "google", "ollama", "azure"])
      .default("openai"),
    EMBEDDINGS_PROVIDER: z
      .enum(["openai", "google", "ollama", "azure"])
      .optional(),

    // Inline batch fallback (when Batch API is unavailable)
    INLINE_BATCH_TTL_MS: z.coerce.number().int().positive().default(3600000),
    MAX_INLINE_BATCHES: z.coerce.number().int().positive().default(500),
    INLINE_BATCH_CONCURRENCY: z.coerce.number().int().positive().default(8),

    // Reranking configuration
    RERANK_PROVIDER: z.enum(["cohere", "ollama", "openai", "none"]).default("none"),
    COHERE_API_KEY: z.string().optional(),
    COHERE_RERANK_MODEL: z.string().default("rerank-english-v3.0"),
    COHERE_SCORE_THRESHOLD: z.string().default("0.3"),
    OLLAMA_RERANK_MODEL: z.string().default("dengcao/Qwen3-Reranker-8B:Q4_K_M"),
    OLLAMA_SCORE_THRESHOLD: z.string().default("0.3"),
    RERANK_API_KEY: z.string().optional(),
    RERANK_BASE_URL: z.string().optional(),
    RERANK_MODEL: z.string().default("qwen3-reranker-8b"),
    RERANK_SCORE_THRESHOLD: z.string().default("0.3"),

    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),

    // Search-v2 label match tuning
    SEARCH_LABEL_VECTOR_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7),

    // Provider configuration
    GRAPH_PROVIDER: z.enum(["neo4j"]).default("neo4j"),
    VECTOR_PROVIDER: z.enum(["pgvector"]).default("pgvector"),
    MODEL_PROVIDER: z.enum(["vercel-ai"]).default("vercel-ai"),

    EXA_API_KEY: z.string().optional(),
  });

export type Environment = z.infer<typeof EnvironmentSchema>;

let env: z.infer<typeof EnvironmentSchema>;

try {
  env = EnvironmentSchema.parse(process.env);
} catch (e) {
  if (e instanceof z.ZodError) {
    console.error("Environment validation failed:");
    for (const issue of e.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
  }
  env = process.env as unknown as z.infer<typeof EnvironmentSchema>;
}

// Normalize blank env vars so lower-level SDKs that read process.env directly
// don't treat empty strings like valid URLs.
for (const key of ["OPENAI_BASE_URL", "OLLAMA_URL", "AZURE_BASE_URL"]) {
  if (typeof process.env[key] === "string" && process.env[key]!.trim() === "") {
    delete process.env[key];
  }
}

export { env };
