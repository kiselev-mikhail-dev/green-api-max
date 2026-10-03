/**
 * Константы и типы для работы с Green-API.
 *
 * В `greenApiConfig` остаются только неконфиденциальные параметры.
 * `idInstance` и `apiTokenInstance` вводятся пользователем в интерфейсе —
 * см. `@/lib/green-api-credentials`.
 */

export type GreenApiConfig = {
  /** Базовый адрес API инстанса */
  apiUrl: string;
  /** Базовый адрес для медиафайлов */
  mediaUrl: string;
};

/** Учётные данные инстанса, которые вводит пользователь */
export type GreenApiCredentials = {
  /** ID инстанса */
  idInstance: string;
  /** Токен авторизации инстанса */
  apiTokenInstance: string;
};

export const greenApiConfig: GreenApiConfig = {
  apiUrl: "https://3100.api.green-api.com",
  mediaUrl: "https://3100.api.green-api.com"
};

export const {
  apiUrl: GREEN_API_URL,
  mediaUrl: GREEN_API_MEDIA_URL
} = greenApiConfig;

/** Пустые учётные данные — стартовое значение до ввода пользователем */
export const emptyGreenApiCredentials: GreenApiCredentials = {
  idInstance: "",
  apiTokenInstance: "",
};

/* --------------------------------------------------- формат полей ввода -- */

/** Длина `apiTokenInstance` в Green-API (50 символов) */
export const API_TOKEN_LENGTH = 50;

/** Токен состоит только из цифр и латинских букв */
const API_TOKEN_FORMAT = new RegExp(`^[0-9A-Za-z]{${API_TOKEN_LENGTH}}$`);

/**
 * `idInstance` — только цифры (значение подставляется в путь URL:
 * `/waInstance{idInstance}/...`).
 */
export function sanitizeIdInstance(value: string): string {
  return value.replace(/\D/g, "");
}

/** `apiTokenInstance` — только цифры и латинские буквы, без прочих символов. */
export function sanitizeApiToken(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "");
}

/** Токен корректен: ровно 64 символа, только цифры и латинские буквы. */
export function isValidApiToken(value: string): boolean {
  return API_TOKEN_FORMAT.test(value);
}

/**
 * URL метода Green-API.
 *
 * Шаблон запроса: `{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}`
 *
 * @example
 * greenApiUrl("getStateInstance", { idInstance: "310022754476", apiTokenInstance: "abc" })
 * // https://3100.api.green-api.com/waInstance310022754476/getStateInstance/abc
 */
export function greenApiUrl(
  method: string,
  credentials: GreenApiCredentials,
): string {
  const idInstance = credentials.idInstance.trim();
  const apiTokenInstance = credentials.apiTokenInstance.trim();
  return `${GREEN_API_URL}/waInstance${idInstance}/${method}/${apiTokenInstance}`;
}

/**
 * Ответ Green-API с HTTP-статусом вне диапазона 2xx.
 *
 * Отдельный класс, чтобы вызывающий код мог отличить ошибку сервиса
 * (например неверный `apiTokenInstance`) от сетевого сбоя и от ошибок
 * валидации входных данных.
 */
export class GreenApiHttpError extends Error {
  /** HTTP-статус ответа */
  readonly status: number;

  constructor(status: number, details: string) {
    super(`Green-API вернул ${status}${details ? `: ${details}` : ""}`);
    this.name = "GreenApiHttpError";
    this.status = status;
  }
}

/**
 * Низкоуровневый запрос к Green-API.
 *
 * Бросает `GreenApiHttpError` при ответе не 2xx и `Error` при сетевой ошибке.
 * Пустой ответ тела трактуется как `null`.
 */
async function greenApiRequest<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("не удалось обратиться к Green-API, проверьте сеть и apiUrl");
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new GreenApiHttpError(response.status, details);
  }

  const text = await response.text().catch(() => "");

  if (!text.trim()) {
    return null as T;
  }

  return JSON.parse(text) as T;
}

/** URL метода с дополнительным сегментом пути, например `receiptId`. */
function greenApiPathUrl(
  method: string,
  credentials: GreenApiCredentials,
  pathSegment?: string,
): string {
  const url = greenApiUrl(method, credentials);

  return pathSegment === undefined
    ? url
    : `${url}/${encodeURIComponent(pathSegment)}`;
}

/**
 * POST-запрос к методу Green-API с JSON-телом в кодировке UTF-8 без BOM.
 *
 * @example
 * await greenApiPost("sendMessage", credentials, { chatId, message })
 */
export function greenApiPost<T>(
  method: string,
  credentials: GreenApiCredentials,
  body: unknown,
): Promise<T> {
  return greenApiRequest<T>(greenApiUrl(method, credentials), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
}

/**
 * GET-запрос к методу Green-API.
 *
 * @example
 * await greenApiGet("receiveNotification", credentials, { receiveTimeout: 10 })
 */
export function greenApiGet<T>(
  method: string,
  credentials: GreenApiCredentials,
  searchParams?: Record<string, string | number>,
): Promise<T> {
  const query = searchParams
    ? `?${new URLSearchParams(
        Object.entries(searchParams).map(([key, value]) => [key, String(value)]),
      ).toString()}`
    : "";

  return greenApiRequest<T>(
    `${greenApiUrl(method, credentials)}${query}`,
    { method: "GET" },
  );
}

/**
 * DELETE-запрос к методу Green-API.
 *
 * @example
 * await greenApiDelete("deleteNotification", credentials, "1234567")
 */
export function greenApiDelete<T>(
  method: string,
  credentials: GreenApiCredentials,
  pathSegment?: string,
): Promise<T> {
  return greenApiRequest<T>(
    greenApiPathUrl(method, credentials, pathSegment),
    { method: "DELETE" },
  );
}