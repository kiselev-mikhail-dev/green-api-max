"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Avatar, Flex, IconButton, MaxUI, Textarea, Typography } from "@maxhub/max-ui";
import { createChat } from "@/lib/green-api-chat";
import { sendMessage } from "@/lib/green-api-message";
import {
  deleteNotification,
  describeNotification,
  isSilentNotification,
  parseNotificationMessage,
  receiveNotification,
} from "@/lib/green-api-notification";
import {
  getStoredGreenApiCredentials,
  useGreenApiCredentials,
} from "@/lib/use-green-api-credentials";

/* ------------------------------------------------------------------ icons */

type IconProps = {
  size?: number;
  className?: string;
};

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Icon({
  size = 24,
  className,
  viewBox = "0 0 24 24",
  children,
}: IconProps & { viewBox?: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const IconAttach = ({ size = 22, className }: IconProps) => (
  <Icon size={size} className={className}>
    <path
      {...stroke}
      d="M21.4 11 12.3 20.2a6 6 0 0 1-8.5-8.5l8.5-8.5a4 4 0 0 1 5.7 5.7l-8.5 8.4a2 2 0 0 1-2.8-2.8l7.8-7.8"
    />
  </Icon>
);

const IconSend = ({ size = 22, className }: IconProps) => (
  <Icon size={size} className={className}>
    <path {...stroke} strokeWidth={2} d="M12 19.5V5.5" />
    <path {...stroke} strokeWidth={2} d="m6.4 11.1 5.6-5.6 5.6 5.6" />
  </Icon>
);

function VerifiedBadge({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#007aff"
        d="M12 1.6l2.4 2.1 3.2-.3 1.1 3 2.9 1.4-.7 3.1.7 3.1-2.9 1.4-1.1 3-3.2-.3L12 22.4l-2.4-2.1-3.2.3-1.1-3-2.9-1.4.7-3.1-.7-3.1 2.9-1.4 1.1-3 3.2.3L12 1.6Z"
      />
      <path
        fill="#ffffff"
        d="M11 15.1 7.9 12l1.3-1.3L11 12.5l3.8-3.8 1.3 1.3-5.1 5.1Z"
      />
    </svg>
  );
}

/* --------------------------------------------------------------- messages */

/** Шаги настройки: чат по очереди спрашивает данные */
type SetupStep =
  | "idInstance"
  | "apiTokenInstance"
  | "phoneNumber"
  | "creating"
  | "ready"
  | "sending";

type MessageKind = "incoming" | "outgoing" | "note";

type ChatMessage = {
  id: number;
  kind: MessageKind;
  text: string;
  time: string;
};

const STEP_PROMPTS: Record<
  "idInstance" | "apiTokenInstance" | "phoneNumber",
  string
> = {
  idInstance: "Введите idInstance инстанса",
  apiTokenInstance: "Введите apiTokenInstance",
  phoneNumber: "Введите номер телефона",
};

let messageSequence = 0;

function nextMessageId(): number {
  messageSequence += 1;
  return messageSequence;
}

function formatTime(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function createMessage(
  kind: MessageKind,
  text: string,
  id = nextMessageId(),
): ChatMessage {
  return { id, kind, text, time: formatTime() };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Секреты (например apiTokenInstance) показываем звёздочками вместо символов. */
function maskSecret(value: string): string {
  return "*".repeat(value.length);
}

/** Сколько ждём уведомление в одном запросе `receiveNotification`, сек */
const POLL_RECEIVE_TIMEOUT_SECONDS = 10;

/**
 * Пауза между запросами, когда уведомлений нет, мс.
 *
 * Важно: сервер отвечает на `receiveNotification` сразу и не держит соединение
 * (long-poll не поддерживается), поэтому без паузы получился бы бесконечный
 * цикл запросов «в ноль» — его и отсекаем интервалом опроса.
 */
const POLL_IDLE_DELAY_MS = 1500;

/** Пауза перед повтором после ошибки получения уведомлений, мс */
const POLL_ERROR_RETRY_DELAY_MS = 5000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/* ------------------------------------------------------------------ header */

function ChatHeader({ status }: { status: string }) {
  return (
    <div className="max-chat__header">
      <Avatar.Container size={40} form="circle" className="max-avatar--security">
        <Avatar.Icon className="max-avatar__glyph">
          <svg width="21" height="21" viewBox="0 0 24 24">
            <rect x="5" y="10" width="14" height="10" rx="2.6" fill="#ffffff" />
            <path
              d="M8 10V7.8a4 4 0 0 1 8 0V10"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="14.6" r="1.3" fill="#6b5bd6" />
          </svg>
        </Avatar.Icon>
      </Avatar.Container>

      <span className="max-chat__headinfo">
        <Flex align="center" gap={6}>
          <Typography.Title variant="large-strong">
            Подключение Green-API
          </Typography.Title>
          <VerifiedBadge size={18} />
        </Flex>
        <Typography.Text variant="description" color="secondary">
          {status}
        </Typography.Text>
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- bubbles -- */

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.kind === "note") {
    return (
      <span className="max-note">
        <Typography.Text variant="description" color="inherit">
          {message.text}
        </Typography.Text>
      </span>
    );
  }

  const isOutgoing = message.kind === "outgoing";

  return (
    <Flex justify={isOutgoing ? "end" : "start"} className="max-bubble-row">
      <span
        className={`max-bubble ${
          isOutgoing ? "max-bubble--outgoing" : "max-bubble--incoming"
        }`}
      >
        <Typography.Text variant="body" color="inherit">
          {message.text}
        </Typography.Text>
        <Typography.Text
          variant="description"
          color="inherit"
          className="max-bubble__time"
        >
          {message.time}
        </Typography.Text>
      </span>
    </Flex>
  );
}

/* -------------------------------------------------------------- composer -- */

function Composer({
  disabled = false,
  placeholder = "Сообщение",
  onSend,
}: {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && draft.trim().length > 0;

  // Автовысота: подгоняем поле под содержимое (предел задан в CSS).
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft]);

  const send = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    onSend(text);
    setDraft("");
  };

  return (
    <div className="max-composer">
      <IconButton
        size="medium"
        variant="ghost"
        className="max-composer__attach"
        disabled={disabled}
        aria-label="Прикрепить файл"
      >
        <IconAttach />
      </IconButton>

      <Textarea
        ref={textareaRef}
        className="max-composer__field"
        innerClassNames={{ textarea: "max-composer__input" }}
        mode="secondary"
        rows={1}
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />

      <IconButton
        size="medium"
        variant="primary"
        className="max-composer__send"
        aria-label="Отправить"
        disabled={!canSend}
        onClick={send}
      >
        <IconSend />
      </IconButton>
    </div>
  );
}

/* ---------------------------------------------------------- conversation -- */

function ConversationPane() {
  const { setIdInstance, setApiTokenInstance } = useGreenApiCredentials();
  const [step, setStep] = useState<SetupStep>("idInstance");
  const [chatId, setChatId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage("incoming", STEP_PROMPTS.idInstance),
  ]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pollingErrorShownRef = useRef(false);

  // Держим последнее сообщение в зоне видимости.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }, [messages]);

  // Входящие уведомления: receiveNotification → deleteNotification в цикле.
  // Запускаем по флагу `isListening`, а не по `chatId`: сервер может вернуть
  // пустой chatId, и тогда опрос не стартовал бы вовсе.
  useEffect(() => {
    if (!isListening) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const notification = await receiveNotification(
            getStoredGreenApiCredentials(),
            POLL_RECEIVE_TIMEOUT_SECONDS,
          );

          // Если цикл уже неактуален, уведомление не забираем:
          // оно должно остаться в очереди для следующего поллера.
          if (cancelled) {
            return;
          }

          pollingErrorShownRef.current = false;
          setPollCount((count) => count + 1);

          if (!notification) {
            // Уведомлений нет: сервер не держит long-poll, поэтому интервал
            // опроса выдерживаем сами — иначе цикл крутится «в ноль».
            await delay(POLL_IDLE_DELAY_MS);
            continue;
          }

          await deleteNotification(
            getStoredGreenApiCredentials(),
            notification.receiptId,
          );

          if (cancelled) {
            return;
          }

          const message = parseNotificationMessage(notification.body);

          if (message && message.chatId === chatId) {
            setMessages((list) => [
              ...list,
              createMessage(message.direction, message.text),
            ]);
          } else if (message) {
            setMessages((list) => [
              ...list,
              createMessage(
                "note",
                `Сообщение из другого чата (${message.chatId}): ${message.text}`,
              ),
            ]);
          } else if (!isSilentNotification(notification.body)) {
            // Структура уведомления отличается от ожидаемой — показываем
            // как есть, чтобы ничего не терялось молча.
            setMessages((list) => [
              ...list,
              createMessage(
                "note",
                `Уведомление ${describeNotification(notification.body)}`,
              ),
            ]);
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          if (!pollingErrorShownRef.current) {
            pollingErrorShownRef.current = true;
            setMessages((list) => [
              ...list,
              createMessage(
                "incoming",
                `Не удалось получить входящие: ${errorText(error)}`,
              ),
            ]);
          }

          await delay(POLL_ERROR_RETRY_DELAY_MS);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [isListening]);

  const headerStatus = isListening
    ? `Ожидаю входящие · опрос №${pollCount}`
    : "Сервисные уведомления";

  const replaceMessage = (id: number, kind: MessageKind, text: string) => {
    setMessages((list) =>
      list.map((message) =>
        message.id === id ? createMessage(kind, text, id) : message,
      ),
    );
  };

  const handleSend = async (text: string) => {
    if (step === "creating" || step === "sending") {
      return;
    }

    if (step === "ready") {
      const pendingId = nextMessageId();
      setMessages((list) => [
        ...list,
        createMessage("outgoing", text),
        createMessage("note", "Отправляю сообщение…", pendingId),
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
          "incoming",
          `Не удалось отправить сообщение: ${errorText(error)}`,
        );
      } finally {
        setStep("ready");
      }

      return;
    }

    if (step === "idInstance") {
      setIdInstance(text);
      setMessages((list) => [
        ...list,
        createMessage("outgoing", text),
        createMessage("incoming", STEP_PROMPTS.apiTokenInstance),
      ]);
      setStep("apiTokenInstance");
      return;
    }

    if (step === "apiTokenInstance") {
      setApiTokenInstance(text);
      setMessages((list) => [
        ...list,
        createMessage("outgoing", maskSecret(text)),
        createMessage("incoming", STEP_PROMPTS.phoneNumber),
      ]);
      setStep("phoneNumber");
      return;
    }

    // Шаг с номером телефона: проверяем наличие аккаунта MAX на номере.
    const pendingId = nextMessageId();
    setMessages((list) => [
      ...list,
      createMessage("outgoing", text),
      createMessage("note", "Проверяем номер…", pendingId),
    ]);
    setStep("creating");

    try {
      const result = await createChat({
        credentials: getStoredGreenApiCredentials(),
        phoneNumber: text,
      });

      if (!result.exist) {
        replaceMessage(
          pendingId,
          "incoming",
          `Аккаунт MAX на номере ${text} не найден. Проверьте номер телефона и попробуйте снова.`,
        );
        setStep("phoneNumber");
        return;
      }

      setChatId(result.chatId);
      setIsListening(true);
      replaceMessage(
        pendingId,
        "incoming",
        `Аккаунт найден. chatId: ${result.chatId ?? "не вернулся в ответе"}`,
      );
      setMessages((list) => [
        ...list,
        createMessage("incoming", "Теперь напишите сообщение в чате."),
        createMessage("note", "Слушаю входящие сообщения…"),
      ]);
      setStep("ready");
    } catch (error) {
      replaceMessage(
        pendingId,
        "incoming",
        `Не удалось создать чат: ${errorText(error)}`,
      );
      setStep("phoneNumber");
    }
  };

  const isBusy = step === "creating" || step === "sending";
  const composerPlaceholder =
    step === "creating"
      ? "Проверяем номер…"
      : step === "sending"
        ? "Отправляю сообщение…"
        : "Сообщение";

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
        disabled={isBusy}
        placeholder={composerPlaceholder}
        onSend={handleSend}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function HomePage() {
  // MAX UI читает window (платформа и системная тема) прямо во время рендера,
  // поэтому до монтирования отдаём пустой каркас: на сервере снапшот `false`,
  // после гидратации — `true`, и дерево дорисовывается без расхождений.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return <div className="max-shell" />;
  }

  return (
    <MaxUI platform="ios" colorScheme="light" resetBody className="max-app">
      <div className="max-shell">
        <ConversationPane />
      </div>
    </MaxUI>
  );
}