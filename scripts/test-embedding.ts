import { getEmbedding } from "../apps/webapp/app/lib/model.server";
import { getDefaultEmbeddingInfo } from "../apps/webapp/app/services/llm-provider.server";
import { prisma } from "../apps/webapp/app/db.server";

async function testEmbedding() {
  console.log("Testing embedding models...\n");
  
  const testText = "这是一个测试文本，用于验证向量嵌入功能。";
  
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.log("No workspace found, creating one...");
    const newWorkspace = await prisma.workspace.create({
      data: {
        name: "test",
        slug: "test",
      },
    });
    console.log(`Created workspace: ${newWorkspace.id}`);
  }
  
  const workspaceId = workspace?.id;
  console.log(`Using workspace: ${workspaceId}\n`);
  
  const embeddingInfo = await getDefaultEmbeddingInfo(workspaceId);
  console.log(`Embedding config: ${JSON.stringify(embeddingInfo, null, 2)}\n`);
  
  console.log(`Testing embedding for: "${testText}"\n`);
  
  try {
    const startTime = Date.now();
    const embedding = await getEmbedding(testText, workspaceId);
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ Embedding generated successfully!`);
    console.log(`   - Dimensions: ${embedding.length}`);
    console.log(`   - Time: ${elapsed}ms`);
    console.log(`   - First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(", ")}]`);
    console.log(`   - Last 5 values: [${embedding.slice(-5).map(v => v.toFixed(4)).join(", ")}]`);
  } catch (error) {
    console.error(`❌ Embedding failed:`, error);
  }
  
  await prisma.$disconnect();
}

testEmbedding().catch(console.error);
