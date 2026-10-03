/** Вид сообщения в ленте */
export type MessageKind = "incoming" | "outgoing" | "note";

/** Сообщение в ленте диалога */
export type ChatMessage = {
  id: number;
  kind: MessageKind;
  text: string;
  /** Время отправки в формате `чч:мм` */
  time: string;
};

const TIME_FORMAT = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

let sequence = 0;

/** Следующий уникальный идентификатор сообщения */
export function nextMessageId(): number {
  sequence += 1;
  return sequence;
}

/**
 * Новое сообщение ленты с текущим временем.
 *
 * Явный `id` нужен, когда сообщение создаётся как заглушка («Проверяем номер…»)
 * и позже подменяется результатом запроса (см. `replaceMessage` в панели).
 */
export function createMessage(
  kind: MessageKind,
  text: string,
  id = nextMessageId(),
): ChatMessage {
  return { id, kind, text, time: TIME_FORMAT.format(new Date()) };
}
