import { PrismaClient } from "@core/database";

const prisma = new PrismaClient();

const INDEX_CONFIGS = [
  { table: "statement_embeddings", name: "statement_embeddings_vector_idx" },
  { table: "episode_embeddings", name: "episode_embeddings_vector_idx" },
  { table: "entity_embeddings", name: "entity_embeddings_vector_idx" },
  { table: "compacted_session_embeddings", name: "compacted_session_embeddings_vector_idx" },
  { table: "label_embeddings", name: "label_embeddings_vector_idx" },
  { table: "voice_aspect_embeddings", name: "voice_aspect_embeddings_vector_idx" },
];

const NEW_DIMENSIONS = 768;

async function rebuildIndexes() {
  console.log(`Rebuilding pgvector indexes for ${NEW_DIMENSIONS} dimensions...\n`);

  for (const { table, name } of INDEX_CONFIGS) {
    try {
      console.log(`Dropping index ${name}...`);
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${name};`);
      console.log(`  ✓ Dropped`);
    } catch (error) {
      console.log(`  ⚠ Drop failed: ${error}`);
    }
  }

  console.log("");

  for (const { table, name } of INDEX_CONFIGS) {
    try {
      console.log(`Creating index ${name} on ${table}...`);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX CONCURRENTLY ${name} ON ${table} USING hnsw ((vector::vector(${NEW_DIMENSIONS})) vector_cosine_ops);`
      );
      console.log(`  ✓ Created`);
    } catch (error) {
      console.log(`  ⚠ Create failed: ${error}`);
    }
  }

  console.log("\nDone!");
  await prisma.$disconnect();
}

rebuildIndexes().catch(console.error);
