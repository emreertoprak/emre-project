import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Yerel, tek kullanıcılı panel: her sayfa SQLite'tan istek anında okunur.
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
