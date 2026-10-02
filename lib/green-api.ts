/**
 * Константы и типы для работы с Green-API.
 *
 * В `greenApiConfig` остаются только неконфиденциальные параметры.
 * `idInstance` и `apiTokenInstance` вводятся пользователем в интерфейсе —
 * см. хук `useGreenApiCredentials` в `@/lib/use-green-api-credentials`.
 */

export type GreenApiConfig = {
  /** Базовый адрес API инстанса */
  apiUrl: string;
  /** Базовый адрес для медиафайлов */
  mediaUrl: string;
  /** Наименование инстанса (подпись) */
  instanceName: string;
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
  mediaUrl: "https://3100.api.green-api.com",
  instanceName: "Instance 310022754476",
};

export const {
  apiUrl: GREEN_API_URL,
  mediaUrl: GREEN_API_MEDIA_URL,
  instanceName: GREEN_API_INSTANCE_NAME,
} = greenApiConfig;

/** Пустые учётные данные — стартовое значение до ввода пользователем */
export const emptyGreenApiCredentials: GreenApiCredentials = {
  idInstance: "",
  apiTokenInstance: "",
};

/** Заполнены ли оба поля учётных данных */
export function isGreenApiConfigured(
  credentials: GreenApiCredentials,
): boolean {
  return (
    credentials.idInstance.trim().length > 0 &&
    credentials.apiTokenInstance.trim().length > 0
  );
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
 * Низкоуровневый запрос к Green-API.
 *
 * Бросает `Error` с понятным текстом при сетевой ошибке или ответе не 2xx.
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
    throw new Error(
      `Green-API вернул ${response.status}${details ? `: ${details}` : ""}`,
    );
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