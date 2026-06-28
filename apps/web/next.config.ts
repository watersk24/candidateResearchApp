import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Needed for Prisma in Next.js App Router server components
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
