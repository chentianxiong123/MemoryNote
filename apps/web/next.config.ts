import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@core/core", "@core/database", "@core/types", "@core/providers"],
  serverExternalPackages: ["@prisma/client", "prisma"],
  typedRoutes: true,
};

export default nextConfig;
