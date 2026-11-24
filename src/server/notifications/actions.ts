"use server";

import { requireUser } from "@/server/auth/session";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationFeed,
} from "./service";

// Devuelven la lista actualizada para que la campana no espere al siguiente sondeo.
export async function markNotificationReadAction(
  id: string,
): Promise<NotificationFeed> {
  const viewer = await requireUser();
  await markNotificationRead(viewer, id);

  return listNotifications(viewer);
}

export async function markAllNotificationsReadAction(): Promise<NotificationFeed> {
  const viewer = await requireUser();
  await markAllNotificationsRead(viewer);

  return listNotifications(viewer);
}
