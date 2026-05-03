import { api } from "./api";
import type { NotificationCategory, NotificationItem } from "../components/ui/notifications-filter";
import type { DashboardRole } from "../types/roles";

export type StaffNotificationRole = DashboardRole;

type ApiNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  createdAt: string;
};

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export async function listStaffNotifications(input: {
  role: StaffNotificationRole;
  limit?: number;
}): Promise<NotificationItem[]> {
  const query = new URLSearchParams();
  query.set("role", input.role);
  if (input.limit) query.set("limit", String(input.limit));
  const rows = await api.get<ApiNotification[]>(`/notifications?${query.toString()}`);
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    time: formatRelativeTime(row.createdAt),
  }));
}
