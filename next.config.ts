import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/slides",
        destination: "/slides/index.html",
        permanent: false,
      },
    ];
  },
  serverExternalPackages: ["@electric-sql/pglite"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
