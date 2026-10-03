/**
 * Сборка статической версии сайта для обычного хостинга.
 *
 * Запускает CLI Next текущего проекта с включённым статическим экспортом
 * (флаг `STATIC_EXPORT` читает next.config.ts) — готовый сайт появляется
 * в `out/` и его можно целиком залить на хостинг.
 *
 * Обёртка нужна, чтобы не тянуть `cross-env` ради одной переменной окружения:
 * Node выставляет её сам, и скрипт одинаково работает в Windows и в Unix.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

const build = spawn(process.execPath, [nextBin, "build"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env, STATIC_EXPORT: "1" },
});

build.on("exit", (code) => {
  process.exit(code ?? 1);
});
