import {
  greenApiDelete,
  greenApiGet,
  type GreenApiCredentials,
} from "./green-api";

/** Границы `receiveTimeout` по документации Green-API, сек */
export const RECEIVE_TIMEOUT_MIN = 5;
export const RECEIVE_TIMEOUT_MAX = 60;

export type GreenApiNotification = {
  /** Идентификатор уведомления — нужен для `deleteNotification` */
  receiptId: number;
  /** Тело уведомления, структура зависит от `typeWebhook` */
  body: unknown;
};

/** Текстовое сообщение из уведомления (входящее или отправленное с телефона) */
export type NotificationMessage = {
  direction: "incoming" | "outgoing";
  chatId: string;
  senderName: string | null;
  text: string;
};

/** Зажимаем `receiveTimeout` в допустимый диапазон 5–60 секунд. */
export function normalizeReceiveTimeout(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return RECEIVE_TIMEOUT_MIN;
  }

  return Math.min(
    RECEIVE_TIMEOUT_MAX,
    Math.max(RECEIVE_TIMEOUT_MIN, Math.round(value)),
  );
}

/**
 * Шаг 1. Получение входящего уведомления (long-polling).
 *
 * `GET {apiUrl}/waInstance{idInstance}/receiveNotification/{apiTokenInstance}?receiveTimeout={seconds}`
 *
 * Возвращает `null`, если за отведённое время уведомлений не пришло.
 */
export async function receiveNotification(
  credentials: GreenApiCredentials,
  receiveTimeoutSeconds?: number,
): Promise<GreenApiNotification | null> {
  if (!credentials.idInstance.trim()) {
    throw new Error("не заполнен idInstance");
  }

  if (!credentials.apiTokenInstance.trim()) {
    throw new Error("не заполнен apiTokenInstance");
  }

  const payload = await greenApiGet<{
    receiptId?: unknown;
    body?: unknown;
  } | null>("receiveNotification", credentials, {
    receiveTimeout: normalizeReceiveTimeout(receiveTimeoutSeconds),
  });

  const rawReceiptId = payload?.receiptId;

  if (
    rawReceiptId === undefined ||
    rawReceiptId === null ||
    rawReceiptId === ""
  ) {
    return null;
  }

  const receiptId = Number(rawReceiptId);

  if (!Number.isFinite(receiptId)) {
    return null;
  }

  return { receiptId, body: payload?.body };
}

/**
 * Шаг 2. Подтверждение получения и обработки уведомления.
 *
 * `DELETE {apiUrl}/waInstance{idInstance}/deleteNotification/{apiTokenInstance}/{receiptId}`
 */
export async function deleteNotification(
  credentials: GreenApiCredentials,
  receiptId: number,
): Promise<boolean> {
  if (!Number.isFinite(receiptId)) {
    throw new Error("некорректный receiptId");
  }

  const payload = await greenApiDelete<{ result?: unknown } | null>(
    "deleteNotification",
    credentials,
    String(receiptId),
  );

  return payload?.result === true;
}

/**
 * Тело уведомления иногда приходит JSON-строкой — разворачиваем её.
 */
function toNotificationObject(body: unknown): Record<string, unknown> | null {
  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)
    : null;
}

/**
 * Типы уведомлений, которые не показываем в ленте:
 * это собственные статусы и наша же отправка (её показываем оптимистично).
 */
const SILENT_WEBHOOK_TYPES = new Set([
  "outgoingMessageStatus",
  "outgoingAPIMessageReceived",
]);

/** Служебное уведомление, которое незачем показывать пользователю? */
export function isSilentNotification(body: unknown): boolean {
  const notification = toNotificationObject(body);

  if (!notification) {
    return false;
  }

  const typeWebhook = notification.typeWebhook;

  return (
    typeof typeWebhook === "string" && SILENT_WEBHOOK_TYPES.has(typeWebhook)
  );
}

/**
 * Короткое описание уведомления для диагностики — чтобы ничего не терялось
 * молча, если структура отличается от ожидаемой.
 */
export function describeNotification(body: unknown): string {
  const notification = toNotificationObject(body);

  if (!notification) {
    return String(body);
  }

  const json = JSON.stringify(notification);
  const preview = json.length > 300 ? `${json.slice(0, 300)}…` : json;
  const typeWebhook = notification.typeWebhook;

  return typeof typeWebhook === "string"
    ? `${typeWebhook}: ${preview}`
    : preview;
}

/** Текст сообщения: обычное или расширенное (со ссылкой) текстовое сообщение */
function extractMessageText(messageData: {
  textMessageData?: { textMessage?: unknown };
  extendedTextMessageData?: { text?: unknown };
} | undefined): string | null {
  const text =
    messageData?.textMessageData?.textMessage ??
    messageData?.extendedTextMessageData?.text;

  return typeof text === "string" ? text : null;
}

/**
 * Разбираем текстовое сообщение из тела уведомления MAX.
 *
 * Структура (проверено на реальных уведомлениях):
 * ```json
 * {
 *   "typeWebhook": "incomingMessageReceived",
 *   "senderData": { "chatId": "465353812", "senderName": "М", "senderPhoneNumber": 79176102323 },
 *   "messageData": { "typeMessage": "textMessage", "textMessageData": { "textMessage": "..." } }
 * }
 * ```
 * Отправленные с телефона сообщения приходят как `outgoingMessageReceived` —
 * их тоже показываем (как исходящие). Свою отправку через API
 * (`outgoingAPIMessageReceived`) не показываем: она уже есть в ленте.
 *
 * Если структура другая — возвращаем `null`, и вызывающий код покажет
 * уведомление как есть (см. `describeNotification`).
 */
export function parseNotificationMessage(
  body: unknown,
): NotificationMessage | null {
  const notification = toNotificationObject(body);

  if (!notification) {
    return null;
  }

  const typeWebhook = notification.typeWebhook;

  const direction =
    typeWebhook === "incomingMessageReceived"
      ? "incoming"
      : typeWebhook === "outgoingMessageReceived"
        ? "outgoing"
        : null;

  if (!direction) {
    return null;
  }

  const senderData = notification.senderData as
    | { chatId?: unknown; senderName?: unknown }
    | undefined;
  const messageData = notification.messageData as
    | {
        textMessageData?: { textMessage?: unknown };
        extendedTextMessageData?: { text?: unknown };
      }
    | undefined;

  const text = extractMessageText(messageData);
  const chatId = senderData?.chatId;

  if (typeof text !== "string" || typeof chatId !== "string") {
    return null;
  }

  const senderName = senderData?.senderName;

  return {
    direction,
    chatId,
    text,
    senderName: typeof senderName === "string" ? senderName : null,
  };
}