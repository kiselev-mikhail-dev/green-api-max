import { emptyGreenApiCredentials, type GreenApiCredentials } from "./green-api";

const STORAGE_KEY = "green-api:credentials";

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

/**
 * Сохранённые учётные данные инстанса.
 *
 * Значения читаются на момент вызова (а не подпиской): экрану они нужны только
 * как аргумент запроса, отображать их негде.
 */
export function getStoredGreenApiCredentials(): GreenApiCredentials {
  if (typeof window === "undefined") {
    return emptyGreenApiCredentials;
  }

  return parseCredentials(window.localStorage.getItem(STORAGE_KEY));
}

function writeCredentials(next: GreenApiCredentials): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Хранилище может быть недоступно (приватный режим) — ввод всё равно
    // продолжит работать, просто не переживёт перезагрузку.
  }
}

/** Запомнить `idInstance`, не затрагивая токен */
export function saveIdInstance(idInstance: string): void {
  writeCredentials({
    ...getStoredGreenApiCredentials(),
    idInstance: idInstance.trim(),
  });
}

/** Запомнить `apiTokenInstance`, не затрагивая остальное */
export function saveApiTokenInstance(apiTokenInstance: string): void {
  writeCredentials({
    ...getStoredGreenApiCredentials(),
    apiTokenInstance: apiTokenInstance.trim(),
  });
}

/** Забыть учётные данные (например после ошибки сервиса) */
export function resetGreenApiCredentials(): void {
  writeCredentials(emptyGreenApiCredentials);
}
