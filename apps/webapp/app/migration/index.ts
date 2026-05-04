import { prisma } from "~/db.server";

const DEFAULT_SKILLS_MIGRATION_KEY = "defaultSkillsV1Seeded";

async function migrateDefaultSkills() {
  const allWorkspaces = await prisma.workspace.findMany({
    select: { id: true, metadata: true },
  });

  const workspacesNeedingMigration = allWorkspaces.filter((workspace) => {
    const metadata = workspace.metadata as Record<string, unknown>;
    return !metadata?.[DEFAULT_SKILLS_MIGRATION_KEY];
  });

  if (workspacesNeedingMigration.length === 0) {
    console.log("No workspaces need default skill seeding.");
    return;
  }

  console.log(`Migration skipped for ${workspacesNeedingMigration.length} workspaces (simplified mode).`);

  const workspaceIds = workspacesNeedingMigration.map((w) => w.id);

  await prisma.$executeRaw`
    UPDATE "Workspace"
    SET metadata = metadata || ${JSON.stringify({ [DEFAULT_SKILLS_MIGRATION_KEY]: true })}::jsonb
    WHERE id = ANY(${workspaceIds}::text[])
  `;

  console.log("Default skills migration complete (simplified).");
}

export const migration = async () => {
  await migrateDefaultSkills();
};
