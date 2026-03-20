import * as React from "react";
import { NotificationsFilter, type NotificationItem } from "../../ui/notifications-filter";

export function NotificationBell({
  items,
  placement = "bottom",
}: {
  items: NotificationItem[];
  placement?: "bottom" | "right";
}) {
  return <NotificationsFilter items={items} placement={placement} />;
}

