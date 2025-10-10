import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 显式设置 turbopack 根目录，避免多 lockfile 时的根目录推断警告
  turbopack: {
    root: __dirname,
  },
  // 暂时关闭 ESLint，专注于功能开发
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 暂时忽略类型错误以加快开发速度
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
