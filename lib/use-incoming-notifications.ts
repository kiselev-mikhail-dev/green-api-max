"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteNotification,
  parseNotificationMessage,
  receiveNotification,
  type NotificationMessage,
} from "./green-api-notification";
import { getStoredGreenApiCredentials } from "./green-api-credentials";
import { errorText } from "./format";

/** Сколько ждём уведомление в одном запросе `receiveNotification`, сек */
const RECEIVE_TIMEOUT_SECONDS = 10;

/**
 * Пауза между запросами, когда уведомлений нет, мс.
 *
 * Важно: сервер отвечает на `receiveNotification` сразу и не держит соединение
 * (long-poll не поддерживается), поэтому без паузы получился бы бесконечный
 * цикл запросов «в ноль» — его и отсекаем интервалом опроса.
 */
const IDLE_DELAY_MS = 1500;

/** Пауза перед повтором после ошибки получения, мс */
const ERROR_RETRY_DELAY_MS = 5000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type UseIncomingNotificationsOptions = {
  /** Опрашивать ли сервер прямо сейчас */
  enabled: boolean;
  /** Чат, сообщения которого показываем */
  chatId: string | null;
  onIncoming: (message: NotificationMessage) => void;
  onError: (text: string) => void;
};

/**
 * Приём входящих уведомлений: `receiveNotification` → `deleteNotification` в цикле.
 *
 * Запускается по флагу `enabled`, а не по `chatId`: сервер может вернуть пустой
 * `chatId`, и тогда опрос не стартовал бы вовсе.
 *
 * Показываются только сообщения чата `chatId`; уведомления из других чатов и
 * служебные типы подтверждаются, но игнорируются.
 */
export function useIncomingNotifications({
  enabled,
  chatId,
  onIncoming,
  onError,
}: UseIncomingNotificationsOptions): { pollCount: number } {
  const [pollCount, setPollCount] = useState(0);
  const chatIdRef = useRef(chatId);
  const onIncomingRef = useRef(onIncoming);
  const onErrorRef = useRef(onError);

  // Обновляем refs после каждого рендера: цикл опроса видит актуальные значения,
  // но не перезапускается из-за их изменения.
  useEffect(() => {
    chatIdRef.current = chatId;
    onIncomingRef.current = onIncoming;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let errorReported = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const notification = await receiveNotification(
            getStoredGreenApiCredentials(),
            RECEIVE_TIMEOUT_SECONDS,
          );

          // Если цикл уже неактуален, уведомление не забираем:
          // оно должно остаться в очереди для следующего поллера.
          if (cancelled) {
            return;
          }

          errorReported = false;
          setPollCount((count) => count + 1);

          if (!notification) {
            await delay(IDLE_DELAY_MS);
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

          if (message && message.chatId === chatIdRef.current) {
            onIncomingRef.current(message);
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          // Об ошибке сообщаем один раз: пока запросы падают, лента не должна
          // заполняться одинаковыми сообщениями.
          if (!errorReported) {
            errorReported = true;
            onErrorRef.current(errorText(error));
          }

          await delay(ERROR_RETRY_DELAY_MS);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { pollCount };
}
