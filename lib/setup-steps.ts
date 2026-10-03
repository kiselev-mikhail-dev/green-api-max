import {
  API_TOKEN_LENGTH,
  sanitizeApiToken,
  sanitizeIdInstance,
} from "./green-api";

/** Шаги настройки: чат по очереди спрашивает данные */
export type SetupStep =
  | "idInstance"
  | "apiTokenInstance"
  | "phoneNumber"
  | "creating"
  | "ready"
  | "sending";

/** Шаги, на которых пользователь вводит значение */
export type InputStep = "idInstance" | "apiTokenInstance" | "phoneNumber";

/** Что чат просит на каждом шаге ввода */
export const STEP_PROMPTS: Record<InputStep, string> = {
  idInstance: "Введите idInstance (только цифры)",
  apiTokenInstance: `Введите apiTokenInstance (${API_TOKEN_LENGTH} символов: цифры и латинские буквы)`,
  phoneNumber: "Введите номер телефона",
};

/** Ответ чата, если `apiTokenInstance` не соответствует формату */
export const API_TOKEN_INVALID_PROMPT = `apiTokenInstance должен состоять из ${API_TOKEN_LENGTH} цифр и латинских букв. Введите значение ещё раз.`;

/** Плашка «идёт запрос» и подсказка композера на шагах ожидания */
export const PENDING_HINTS = {
  creating: { note: "Проверяем номер…", placeholder: "Проверяем номер…" },
  sending: {
    note: "Отправляю сообщение…",
    placeholder: "Отправляю сообщение…",
  },
} as const;

/** Правила ввода в поле композера для шага настройки */
export type ComposerInput = {
  /** Приводит вводимое значение к допустимому виду (маска ввода) */
  sanitize?: (value: string) => string;
  /** Максимальная длина вводимого значения */
  maxLength?: number;
  /** Подсказка виртуальной клавиатуре */
  inputMode?: "text" | "numeric";
};

const EMPTY_INPUT: ComposerInput = {};

/** Какие символы и какой длины допускает поле на текущем шаге */
export function composerInputFor(step: SetupStep): ComposerInput {
  if (step === "idInstance") {
    return { sanitize: sanitizeIdInstance, inputMode: "numeric" };
  }

  if (step === "apiTokenInstance") {
    return {
      sanitize: sanitizeApiToken,
      maxLength: API_TOKEN_LENGTH,
      inputMode: "text",
    };
  }

  return EMPTY_INPUT;
}

/** Идёт ли запрос к сервису (поле и кнопки заблокированы) */
export function isBusyStep(step: SetupStep): boolean {
  return step === "creating" || step === "sending";
}

/** Подсказка в пустом поле композера */
export function composerPlaceholder(step: SetupStep): string {
  if (step === "creating") {
    return PENDING_HINTS.creating.placeholder;
  }

  if (step === "sending") {
    return PENDING_HINTS.sending.placeholder;
  }

  return "Сообщение";
}

/**
 * Ответ чата, если `checkAccount` вернул ошибку сервиса (HTTP-статус не 200).
 * Скорее всего неверные `idInstance` или `apiTokenInstance`.
 */
export function checkAccountFailedPrompt(status: number): string {
  return (
    "Что-то пошло не так при обращении к Green-API" +
    ` (код ответа ${status}). Давайте начнем с начала.`
  );
}
