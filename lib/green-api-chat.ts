import { greenApiPost, type GreenApiCredentials } from "./green-api";

/** Данные, необходимые для создания чата */
export type CreateChatRequest = {
  credentials: GreenApiCredentials;
  phoneNumber: string;
};

/** Ответ метода `checkAccount` */
export type CreateChatResult = {
  /** Флаг наличия аккаунта MAX на номере телефона */
  exist: boolean;
  /** chatId пользователя MAX на номере телефона (`null`, если аккаунта нет) */
  chatId: string | null;
  /** true — данные из кеша, false — получены с сервера MAX */
  fromCache: boolean;
};

const CHECK_ACCOUNT_METHOD = "checkAccount";

/**
 * Оставляем только цифры и приводим номер РФ к формату Green-API:
 * ведущая «8» заменяется на «7».
 *
 * `+7 (999) 123-45-67` → `79991234567`
 * `8 999 123 45 67`    → `79991234567`
 * `+375 (29) 123-45-67` → `375291234567`
 */
export function normalizePhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }

  return digits;
}

/**
 * Green-API принимает только номера РФ (`7` + 10 цифр) и РБ (`375` + 9 цифр).
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  return /^7\d{10}$/.test(phoneNumber) || /^375\d{9}$/.test(phoneNumber);
}

/**
 * Создание чата: проверяем, есть ли на номере аккаунт MAX.
 *
 * `POST {apiUrl}/waInstance{idInstance}/checkAccount/{apiTokenInstance}`
 * Тело запроса: `{ "phoneNumber": 79991234567 }`
 * Ответ: `{ "exist": true, "chatId": "79991234567@c.us", "fromCache": false }`
 */
export async function createChat(
  request: CreateChatRequest,
): Promise<CreateChatResult> {
  const idInstance = request.credentials.idInstance.trim();
  const apiTokenInstance = request.credentials.apiTokenInstance.trim();
  const phoneNumber = normalizePhoneNumber(request.phoneNumber);

  if (!idInstance) {
    throw new Error("не заполнен idInstance");
  }

  if (!apiTokenInstance) {
    throw new Error("не заполнен apiTokenInstance");
  }

  if (!isValidPhoneNumber(phoneNumber)) {
    throw new Error("поддерживаются только номера РФ (+7) и РБ (+375)");
  }

  const payload = await greenApiPost<Partial<CreateChatResult>>(
    CHECK_ACCOUNT_METHOD,
    request.credentials,
    { phoneNumber: Number(phoneNumber) },
  );

  const chatId =
    typeof payload.chatId === "string" ? payload.chatId.trim() : "";

  return {
    exist: payload.exist === true,
    // API отдаёт chatId пустой строкой, когда аккаунта нет — приводим к null.
    chatId: chatId || null,
    fromCache: payload.fromCache === true,
  };
}