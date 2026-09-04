const DEFAULT_SKILLS_MIGRATION_KEY = "defaultSkillsV1Seeded";

async function migrateDefaultSkills() {
  // Personal use: skip workspace migration
  console.log("Migration skipped (personal mode).");
}

export const migration = async () => {
  await migrateDefaultSkills();
};
