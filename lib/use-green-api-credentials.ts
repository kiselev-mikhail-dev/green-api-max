"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  emptyGreenApiCredentials,
  isGreenApiConfigured,
  type GreenApiCredentials,
} from "./green-api";

const STORAGE_KEY = "green-api:credentials";
const CHANGE_EVENT = "green-api:credentials-change";

function parseCredentials(raw: string | null): GreenApiCredentials {
  if (!raw) {
    return emptyGreenApiCredentials;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<GreenApiCredentials>;
    return {
      idInstance:
        typeof parsed.idInstance === "string" ? parsed.idInstance : "",
      apiTokenInstance:
        typeof parsed.apiTokenInstance === "string"
          ? parsed.apiTokenInstance
          : "",
    };
  } catch {
    return emptyGreenApiCredentials;
  }
}

/** Подписка на изменения: своя вкладка (`CHANGE_EVENT`) и другие вкладки (`storage`). */
function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

/** Снапшот на клиенте — значение из `localStorage` (стабильная строка). */
function getSnapshot(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

/** Снапшот на сервере — хранилища нет. */
function getServerSnapshot(): string {
  return "";
}

function writeCredentials(next: GreenApiCredentials) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Хранилище может быть недоступно — ввод всё равно продолжит работать.
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Прочитать сохранённые учётные данные без подписки на изменения.
 * Нужно там, где важны самые свежие значения (например в обработчике отправки).
 */
export function getStoredGreenApiCredentials(): GreenApiCredentials {
  return parseCredentials(getSnapshot());
}

/**
 * Учётные данные инстанса Green-API, введённые пользователем.
 *
 * `localStorage` используется как внешнее хранилище: значения переживают
 * перезагрузку страницы, синхронизируются между вкладками и доступны без
 * расхождений при гидратации (на сервере снапшот пустой).
 */
export function useGreenApiCredentials() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const credentials = useMemo(() => parseCredentials(raw), [raw]);

  const setIdInstance = useCallback((idInstance: string) => {
    writeCredentials({
      ...parseCredentials(getSnapshot()),
      idInstance: idInstance.trim(),
    });
  }, []);

  const setApiTokenInstance = useCallback((apiTokenInstance: string) => {
    writeCredentials({
      ...parseCredentials(getSnapshot()),
      apiTokenInstance: apiTokenInstance.trim(),
    });
  }, []);

  const reset = useCallback(() => {
    writeCredentials(emptyGreenApiCredentials);
  }, []);

  return {
    credentials,
    setIdInstance,
    setApiTokenInstance,
    reset,
    /** Заполнены ли оба поля */
    isConfigured: isGreenApiConfigured(credentials),
  };
}