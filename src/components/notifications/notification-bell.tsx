"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { formatDateTime } from "@/lib/dates";
import { notificationTypeLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/notifications/actions";
import type {
  NotificationFeed,
  NotificationItem,
} from "@/server/notifications/service";

export const NOTIFICATIONS_POLL_MS = 30_000;

async function fetchFeed(): Promise<NotificationFeed | null> {
  try {
    const response = await fetch("/api/notifications", { cache: "no-store" });

    return response.ok ? ((await response.json()) as NotificationFeed) : null;
  } catch {
    return null;
  }
}

function unreadLabel(count: number) {
  if (count === 0) return "Avisos";

  return count === 1 ? "Avisos: 1 sin leer" : `Avisos: ${count} sin leer`;
}

export function NotificationBell({
  initialFeed,
  emptyHint,
}: {
  initialFeed: NotificationFeed;
  emptyHint: string;
}) {
  const router = useRouter();
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState(initialFeed);
  const [lastInitialFeed, setLastInitialFeed] = useState(initialFeed);
  // Solo se aplica la respuesta más reciente: un sondeo lento no pisa lo que ya se marcó.
  const latestRequest = useRef(0);

  if (initialFeed !== lastInitialFeed) {
    setLastInitialFeed(initialFeed);
    setFeed(initialFeed);
  }

  async function load(request: () => Promise<NotificationFeed | null>) {
    const ticket = ++latestRequest.current;
    const next = await request();

    if (next && ticket === latestRequest.current) {
      setFeed(next);
    }
  }

  const poll = useEffectEvent(() => {
    if (document.visibilityState === "visible") void load(fetchFeed);
  });

  // Sondeo cada 30 s mientras la pestaña está a la vista, y al volver a ella.
  useEffect(() => {
    const onTick = () => poll();
    const timer = window.setInterval(onTick, NOTIFICATIONS_POLL_MS);
    document.addEventListener("visibilitychange", onTick);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onTick);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggle() {
    if (!open) void load(fetchFeed);
    setOpen(!open);
  }

  function markLocally(predicate: (item: NotificationItem) => boolean) {
    const now = new Date().toISOString();

    setFeed((current) => {
      const items = current.items.map((item) =>
        !item.readAt && predicate(item) ? { ...item, readAt: now } : item,
      );
      const marked = items.filter(
        (item, index) => item.readAt && !current.items[index].readAt,
      ).length;

      return {
        items,
        unreadCount: Math.max(0, current.unreadCount - marked),
      };
    });
  }

  async function openNotification(
    event: MouseEvent<HTMLAnchorElement>,
    item: NotificationItem,
  ) {
    setOpen(false);

    if (item.readAt) return;

    markLocally(({ id }) => id === item.id);
    const markRead = () =>
      load(() => markNotificationReadAction(item.id)).catch(() => undefined);

    // Abrir en otra pestaña no espera a que se marque.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.button !== 0
    ) {
      void markRead();
      return;
    }

    event.preventDefault();
    await markRead();
    router.push(`/reportes/${item.reportId}`);
  }

  function markAll() {
    markLocally(() => true);
    void load(() => markAllNotificationsReadAction()).catch(() => undefined);
  }

  const { unreadCount, items } = feed;

  return (
    <div ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={unreadLabel(unreadCount)}
        aria-expanded={open}
        aria-controls={panelId}
        className="relative inline-flex size-10 items-center justify-center rounded-lg border bg-background outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-card bg-signal px-1 text-xs font-semibold text-foreground tabular-nums"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Se alinea al contenedor del encabezado (relative), no a la campana:
          así no se sale de la pantalla en celulares angostos. */}
      {open && (
        <section
          id={panelId}
          aria-label="Avisos"
          className="absolute top-full right-4 z-20 -mt-1 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg"
        >
          <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
            <h2 className="font-heading text-lg font-semibold">Avisos</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Marcar todos como leídos
              </button>
            )}
          </header>

          {items.length === 0 ? (
            <div className="space-y-1 px-4 py-5 text-sm">
              <p className="font-medium">No tienes avisos.</p>
              <p className="text-muted-foreground">{emptyHint}</p>
            </div>
          ) : (
            <ul className="max-h-[min(70vh,28rem)] divide-y overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/reportes/${item.reportId}`}
                    onClick={(event) => void openNotification(event, item)}
                    className={cn(
                      "block space-y-0.5 px-4 py-3 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                      !item.readAt && "bg-primary/[0.06]",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {!item.readAt && (
                        <span
                          className="size-2 shrink-0 rounded-full bg-signal ring-1 ring-foreground/30"
                          aria-hidden
                        />
                      )}
                      {notificationTypeLabels[item.type]}
                      {!item.readAt && (
                        <span className="sr-only">, sin leer</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "block text-sm wrap-anywhere",
                        item.readAt && "text-muted-foreground",
                      )}
                    >
                      {item.message}
                    </span>
                    <time
                      dateTime={item.createdAt}
                      className="block text-xs text-muted-foreground"
                    >
                      {formatDateTime(new Date(item.createdAt))}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
