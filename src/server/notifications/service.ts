import type { NotificationType } from "@/generated/prisma/enums";
import { recordIdSchema } from "@/lib/validators/text";
import { AuthorizationError } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";

export const NOTIFICATIONS_LIST_LIMIT = 20;

// Fechas como texto ISO: el mismo formato sale del endpoint y de la página.
export type NotificationItem = {
  id: string;
  type: NotificationType;
  message: string;
  reportId: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationFeed = {
  unreadCount: number;
  items: NotificationItem[];
};

type Recipient = NonNullable<Viewer>;

// Cualquier cuenta activa lee y marca sus propios avisos, y solo esos.
function assertRecipient(viewer: Viewer): asserts viewer is Recipient {
  if (!viewer?.isActive) {
    throw new AuthorizationError();
  }
}

export async function listNotifications(
  viewer: Viewer,
): Promise<NotificationFeed> {
  assertRecipient(viewer);

  const [unreadCount, rows] = await Promise.all([
    db.notification.count({
      where: { recipientId: viewer.id, readAt: null },
    }),
    db.notification.findMany({
      where: { recipientId: viewer.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: NOTIFICATIONS_LIST_LIMIT,
      select: {
        id: true,
        type: true,
        message: true,
        reportId: true,
        createdAt: true,
        readAt: true,
      },
    }),
  ]);

  return {
    unreadCount,
    items: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    })),
  };
}

// Un aviso ajeno, inexistente o ya leído no cambia nada; devuelve cuántos se marcaron.
export async function markNotificationRead(
  viewer: Viewer,
  rawId: unknown,
): Promise<number> {
  assertRecipient(viewer);
  const id = recordIdSchema.safeParse(rawId);

  if (!id.success) {
    return 0;
  }

  const { count } = await db.notification.updateMany({
    where: { id: id.data, recipientId: viewer.id, readAt: null },
    data: { readAt: new Date() },
  });

  return count;
}

export async function markAllNotificationsRead(
  viewer: Viewer,
): Promise<number> {
  assertRecipient(viewer);

  const { count } = await db.notification.updateMany({
    where: { recipientId: viewer.id, readAt: null },
    data: { readAt: new Date() },
  });

  return count;
}
