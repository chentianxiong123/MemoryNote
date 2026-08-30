import { PrismaClient, AuthenticationMethod } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      displayName: "测试用户",
      authenticationMethod: AuthenticationMethod.EMAIL,
    },
  });

  console.log("User created:", user.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
