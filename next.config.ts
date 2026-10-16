import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // เปิดให้ใช้ forbidden()/unauthorized() เพื่อคืน 403 จาก requireAdmin()
    authInterrupts: true,
  },
  images: {
    // รูปโปรไฟล์มาจาก Google OAuth (avatar_url บน user_metadata)
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
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
