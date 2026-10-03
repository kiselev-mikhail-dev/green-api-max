import type { ReactNode } from "react";

export type IconProps = {
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

/** Нейтральный аватар: круг с силуэтом пользователя */
export function IconAvatar({ size = 22, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle {...stroke} cx="12" cy="12" r="9.2" />
      <circle {...stroke} cx="12" cy="9.8" r="3.1" />
      <path {...stroke} d="M6 19.1a6.7 6.7 0 0 1 12 0" />
    </Icon>
  );
}

/** Стрелка отправки */
export function IconSend({ size = 22, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path {...stroke} strokeWidth={2} d="M12 19.5V5.5" />
      <path {...stroke} strokeWidth={2} d="m6.4 11.1 5.6-5.6 5.6 5.6" />
    </Icon>
  );
}

/** Замок в аватаре шапки (белый на градиенте) */
export function IconLock({ size = 21 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
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
  );
}

/** Плашка «проверенный» аккаунт рядом с названием диалога */
export function VerifiedBadge({ size = 18 }: { size?: number }) {
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
