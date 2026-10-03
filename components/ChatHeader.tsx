import { Avatar, Flex, Typography } from "@maxhub/max-ui";
import { IconLock, VerifiedBadge } from "./icons";

/** Шапка диалога: аватар инстанса, название и текущий статус подключения */
export function ChatHeader({ status }: { status: string }) {
  return (
    <div className="max-chat__header">
      <Avatar.Container size={40} form="circle" className="max-avatar--security">
        <Avatar.Icon className="max-avatar__glyph">
          <IconLock />
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
