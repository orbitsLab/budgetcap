import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Required for server actions + Next.js 15+
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Suppress pnpm build warnings for Prisma
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
