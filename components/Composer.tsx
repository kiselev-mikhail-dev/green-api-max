"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton, Textarea } from "@maxhub/max-ui";
import { IconAttach, IconSend } from "./icons";
import type { ComposerInput } from "@/lib/setup-steps";

type ComposerProps = ComposerInput & {
  disabled?: boolean;
  placeholder?: string;
  /** Отправка готового (обрезанного) текста; поле очищается сразу */
  onSend: (text: string) => void;
};

/**
 * Поле ввода сообщения: скрепка, авторастущее поле и кнопка отправки.
 *
 * Маска ввода (`sanitize`, `maxLength`) приходит из правил текущего шага —
 * см. `composerInputFor` в `@/lib/setup-steps`, поэтому компонент не знает,
 * какой шаг настройки сейчас активен.
 */
export function Composer({
  disabled = false,
  placeholder = "Сообщение",
  sanitize,
  maxLength,
  inputMode,
  onSend,
}: ComposerProps) {
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
        inputMode={inputMode}
        value={draft}
        onChange={(event) => {
          // Маска ввода: посторонние символы отбрасываем сразу, в том числе
          // вставленные из буфера обмена, и не даём превысить длину.
          const value = sanitize
            ? sanitize(event.target.value)
            : event.target.value;
          setDraft(maxLength === undefined ? value : value.slice(0, maxLength));
        }}
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
