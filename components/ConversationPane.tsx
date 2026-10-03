"use client";

import { useEffect, useRef, useState } from "react";
import { Typography } from "@maxhub/max-ui";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { createChat } from "@/lib/green-api-chat";
import { sendMessage } from "@/lib/green-api-message";
import { GreenApiHttpError, isValidApiToken } from "@/lib/green-api";
import {
  getStoredGreenApiCredentials,
  resetGreenApiCredentials,
  saveApiTokenInstance,
  saveIdInstance,
} from "@/lib/green-api-credentials";
import {
  createMessage,
  nextMessageId,
  type ChatMessage,
  type MessageKind,
} from "@/lib/chat-message";
import { errorText, maskSecret } from "@/lib/format";
import {
  API_TOKEN_INVALID_PROMPT,
  PENDING_HINTS,
  STEP_PROMPTS,
  checkAccountFailedPrompt,
  composerInputFor,
  composerPlaceholder,
  isBusyStep,
  type SetupStep,
} from "@/lib/setup-steps";
import { useIncomingNotifications } from "@/lib/use-incoming-notifications";

/** Статус в шапке, пока приём входящих не запущен */
const IDLE_STATUS = "Сервисные уведомления";

/**
 * Диалог подключения: чат по шагам спрашивает `idInstance`, токен и номер
 * телефона, затем создаёт чат и обменивается сообщениями.
 */
export function ConversationPane() {
  const [step, setStep] = useState<SetupStep>("idInstance");
  const [chatId, setChatId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage("answer", STEP_PROMPTS.idInstance),
  ]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const appendMessages = (kind: MessageKind, text: string, id?: number) => {
    setMessages((list) => [...list, createMessage(kind, text, id)]);
  };

  /** Подменяет сообщение-заглушку результатом запроса, сохраняя её id и позицию */
  const replaceMessage = (id: number, kind: MessageKind, text: string) => {
    setMessages((list) =>
      list.map((message) =>
        message.id === id ? createMessage(kind, text, id) : message,
      ),
    );
  };

  // Держим последнее сообщение в зоне видимости.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }, [messages]);

  const { pollCount } = useIncomingNotifications({
    enabled: isListening,
    chatId,
    // Пришедшее с сервера — ответ (белый слева); отправленное с телефона —
    // исходящее (синее справа), как и сообщения, отправленные через API.
    onIncoming: (message) =>
      appendMessages(
        message.direction === "outgoing" ? "outgoing" : "answer",
        message.text,
      ),
    onError: (text) =>
      appendMessages("answer", `Не удалось получить входящие: ${text}`),
  });

  const handleSend = async (text: string) => {
    if (isBusyStep(step)) {
      return;
    }

    if (step === "ready") {
      const pendingId = nextMessageId();
      setMessages((list) => [
        ...list,
        createMessage("outgoing", text),
        createMessage("note", PENDING_HINTS.sending.note, pendingId),
      ]);
      setStep("sending");

      try {
        const result = await sendMessage({
          credentials: getStoredGreenApiCredentials(),
          chatId: chatId ?? "",
          message: text,
        });

        replaceMessage(
          pendingId,
          "note",
          result.idMessage
            ? `Сообщение отправлено, id: ${result.idMessage}`
            : "Сообщение отправлено",
        );
      } catch (error) {
        replaceMessage(
          pendingId,
          "answer",
          `Не удалось отправить сообщение: ${errorText(error)}`,
        );
      } finally {
        setStep("ready");
      }

      return;
    }

    if (step === "idInstance") {
      saveIdInstance(text);
      setMessages((list) => [
        ...list,
        createMessage("answer", text),
        createMessage("answer", STEP_PROMPTS.apiTokenInstance),
      ]);
      setStep("apiTokenInstance");
      return;
    }

    if (step === "apiTokenInstance") {
      // Токен нигде не показываем открытым текстом — и в чате тоже.
      const maskedText = maskSecret(text);

      if (!isValidApiToken(text)) {
        setMessages((list) => [
          ...list,
          createMessage("answer", maskedText),
          createMessage("answer", API_TOKEN_INVALID_PROMPT),
        ]);
        return;
      }

      saveApiTokenInstance(text);
      setMessages((list) => [
        ...list,
        createMessage("answer", maskedText),
        createMessage("answer", STEP_PROMPTS.phoneNumber),
      ]);
      setStep("phoneNumber");
      return;
    }

    await createChatByPhone(text);
  };

  /** Последний шаг настройки: проверяем номер и создаём чат */
  async function createChatByPhone(phoneNumber: string) {
    const pendingId = nextMessageId();
    setMessages((list) => [
      ...list,
      createMessage("answer", phoneNumber),
      createMessage("note", PENDING_HINTS.creating.note, pendingId),
    ]);
    setStep("creating");

    try {
      const result = await createChat({
        credentials: getStoredGreenApiCredentials(),
        phoneNumber,
      });

      if (!result.exist) {
        replaceMessage(
          pendingId,
          "answer",
          `Аккаунт MAX на номере ${phoneNumber} не найден. Проверьте номер телефона и попробуйте снова.`,
        );
        setStep("phoneNumber");
        return;
      }

      setChatId(result.chatId);
      setIsListening(true);
      replaceMessage(
        pendingId,
        "answer",
        `Аккаунт найден. chatId: ${result.chatId ?? "не вернулся в ответе"}`,
      );
      appendMessages("answer", "Теперь напишите сообщение в чате.");
      appendMessages("note", "Слушаю входящие сообщения…");
      setStep("ready");
    } catch (error) {
      // Ошибка сервиса (HTTP-статус не 200): скорее всего неверные idInstance
      // или apiTokenInstance — предлагаем ввести их заново.
      if (error instanceof GreenApiHttpError) {
        resetGreenApiCredentials();
        replaceMessage(
          pendingId,
          "answer",
          checkAccountFailedPrompt(error.status),
        );
        appendMessages("answer", STEP_PROMPTS.idInstance);
        setStep("idInstance");
        return;
      }

      replaceMessage(
        pendingId,
        "answer",
        `Не удалось создать чат: ${errorText(error)}`,
      );
      setStep("phoneNumber");
    }
  }

  const headerStatus = isListening
    ? `Ожидаю входящие · опрос №${pollCount}`
    : IDLE_STATUS;

  return (
    <div className="max-chat">
      <ChatHeader status={headerStatus} />

      <div className="max-chat__body" ref={bodyRef}>
        <div className="max-messages">
          <span className="max-date">
            <Typography.Text variant="description" color="inherit">
              Сегодня
            </Typography.Text>
          </span>

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      <Composer
        {...composerInputFor(step)}
        disabled={isBusyStep(step)}
        placeholder={composerPlaceholder(step)}
        onSend={handleSend}
      />
    </div>
  );
}
