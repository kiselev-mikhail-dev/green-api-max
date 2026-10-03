import type { NextConfig } from "next";

/**
 * Статический экспорт включается только для `npm run build:static`.
 *
 * Тогда `next build` дополнительно складывает готовый сайт в `out/` — его
 * можно целиком залить на обычный хостинг. Обычный `npm run build` и
 * `npm run start` при этом работают как прежде.
 */
const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // Без явного корня Turbopack берёт каталог с package-lock.json уровнем выше
  // (он вне git-репозитория) и на каждой сборке предупреждает об этом.
  turbopack: {
    root: __dirname,
  },
  ...(isStaticExport
    ? {
        output: "export" as const,
        // Ссылки на ассеты делаем относительными (`./_next/...`), чтобы
        // сборку можно было положить в любой каталог сайта, а не только
        // в корень домена.
        assetPrefix: ".",
      }
    : {}),
};

export default nextConfig;
