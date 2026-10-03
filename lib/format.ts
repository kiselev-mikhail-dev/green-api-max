/** Текст ошибки из значения неизвестного типа */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Секреты (например `apiTokenInstance`) показываем звёздочками вместо символов. */
export function maskSecret(value: string): string {
  return "*".repeat(value.length);
}
