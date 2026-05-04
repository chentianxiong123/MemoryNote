import { PrismaClient } from "@core/database";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up old conversations...");
  
  const deletedHistory = await prisma.conversationHistory.deleteMany({});
  console.log(`Deleted ${deletedHistory.count} conversation history records`);
  
  const deletedConversations = await prisma.conversation.deleteMany({});
  console.log(`Deleted ${deletedConversations.count} conversations`);
  
  const deletedEpisodes = await prisma.episodeEmbedding.deleteMany({});
  console.log(`Deleted ${deletedEpisodes.count} episode embeddings`);
  
  const deletedStatements = await prisma.statementEmbedding.deleteMany({});
  console.log(`Deleted ${deletedStatements.count} statement embeddings`);
  
  const deletedEntities = await prisma.entityEmbedding.deleteMany({});
  console.log(`Deleted ${deletedEntities.count} entity embeddings`);
  
  const deletedQueue = await prisma.ingestionQueue.deleteMany({});
  console.log(`Deleted ${deletedQueue.count} ingestion queue records`);
  
  console.log("Cleanup completed!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
