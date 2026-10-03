"use client";

import { MaxUI } from "@maxhub/max-ui";
import { ConversationPane } from "@/components/ConversationPane";
import { useMounted } from "@/lib/use-mounted";

/**
 * Страница приложения.
 *
 * MAX UI читает `window` (платформу и системную тему) прямо во время рендера,
 * поэтому до монтирования отдаём пустой каркас — см. `useMounted`.
 */
export default function HomePage() {
  const mounted = useMounted();

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
