import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ほぼ全ページがログインユーザーごとに変わる動的ページなので、
  // Cache Components は使わずリクエスト時レンダリングに統一する。
  cacheComponents: false,
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
