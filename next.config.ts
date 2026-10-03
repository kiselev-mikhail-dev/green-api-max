import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Без явного корня Turbopack берёт каталог с package-lock.json уровнем выше
  // (он вне git-репозитория) и на каждой сборке предупреждает об этом.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
