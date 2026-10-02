import { greenApiPost, type GreenApiCredentials } from "./green-api";

/** Максимальная длина текстового сообщения */
export const MESSAGE_MAX_LENGTH = 4000;

/** Границы времени показа уведомления «печатает…», мс */
export const TYPING_TIME_MIN = 1000;
export const TYPING_TIME_MAX = 20000;

export type SendMessageRequest = {
  credentials: GreenApiCredentials;
  /** Идентификатор чата */
  chatId: string;
  /** Текст сообщения (поддерживаются emoji) */
  message: string;
  /** Время показа уведомления набора сообщения, 1000–20000 мс */
  typingTime?: number;
  /** Идентификатор цитируемого сообщения из того же чата */
  quotedMessageId?: string;
};

export type SendMessageResult = {
  /** Идентификатор отправленного сообщения */
  idMessage: string | null;
};

const SEND_MESSAGE_METHOD = "sendMessage";

/** Ограничиваем `typingTime` допустимым диапазоном 1000–20000 мс. */
export function normalizeTypingTime(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(TYPING_TIME_MAX, Math.max(TYPING_TIME_MIN, Math.round(value)));
}

/**
 * Отправка текстового сообщения в чат по его идентификатору.
 *
 * `POST {apiUrl}/waInstance{idInstance}/sendMessage/{apiTokenInstance}`
 * Тело запроса: `{ chatId, message, typingTime?, quotedMessageId? }`
 *
 * Контракт ответа не был описан, поэтому используется стандартный ответ
 * Green-API — `{ "idMessage": "..." }`; если поля нет, вернётся `null`.
 */
export async function sendMessage(
  request: SendMessageRequest,
): Promise<SendMessageResult> {
  const chatId = request.chatId.trim();
  const message = request.message;

  if (!request.credentials.idInstance.trim()) {
    throw new Error("не заполнен idInstance");
  }

  if (!request.credentials.apiTokenInstance.trim()) {
    throw new Error("не заполнен apiTokenInstance");
  }

  if (!chatId) {
    throw new Error("не заполнен chatId");
  }

  if (!message.trim()) {
    throw new Error("сообщение пустое");
  }

  if (message.length > MESSAGE_MAX_LENGTH) {
    throw new Error(`сообщение длиннее ${MESSAGE_MAX_LENGTH} символов`);
  }

  const typingTime = normalizeTypingTime(request.typingTime);
  const quotedMessageId = request.quotedMessageId?.trim();

  const payload = await greenApiPost<{ idMessage?: unknown }>(
    SEND_MESSAGE_METHOD,
    request.credentials,
    {
      chatId,
      message,
      ...(typingTime === undefined ? {} : { typingTime }),
      ...(quotedMessageId ? { quotedMessageId } : {}),
    },
  );

  return {
    idMessage: typeof payload.idMessage === "string" ? payload.idMessage : null,
  };
}