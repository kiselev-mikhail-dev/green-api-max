"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * `false` на сервере и в первом клиентском рендере, `true` — после гидратации.
 *
 * Нужно для библиотек, которые читают `window` во время рендера (MAX UI
 * определяет платформу и системную тему): до монтирования показываем пустой
 * каркас, иначе пререндер падает с `window is not defined`.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
