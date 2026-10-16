import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // เปิดให้ใช้ forbidden()/unauthorized() เพื่อคืน 403 จาก requireAdmin()
    authInterrupts: true,
  },
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
