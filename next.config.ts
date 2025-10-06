import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 显式设置 turbopack 根目录，避免多 lockfile 时的根目录推断警告
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
