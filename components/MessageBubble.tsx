import { Flex, Typography } from "@maxhub/max-ui";
import type { ChatMessage } from "@/lib/chat-message";

/** Строка ленты: служебная плашка, ответ (белый слева) или исходящее (синее справа) */
export function MessageBubble({ message }: { message: ChatMessage }) {
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
          isOutgoing ? "max-bubble--outgoing" : "max-bubble--answer"
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
