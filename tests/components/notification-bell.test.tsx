import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATIONS_POLL_MS,
  NotificationBell,
} from "@/components/notifications/notification-bell";
import type {
  NotificationFeed,
  NotificationItem,
} from "@/server/notifications/service";

const actions = vi.hoisted(() => ({
  markNotificationReadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
}));
vi.mock("@/server/notifications/actions", () => actions);

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    type: "REPORT_CREATED",
    message: "Folio 12: PC de laboratorio en Edificio N, Lab 3.",
    reportId: "r12",
    createdAt: "2026-11-24T16:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

const feed: NotificationFeed = {
  unreadCount: 2,
  items: [
    item(),
    item({
      id: "n2",
      type: "REPORT_RESOLVED",
      message: "Folio 9 resuelto: Proyector en Edificio A, Aula 2.",
      reportId: "r9",
    }),
    item({
      id: "n3",
      message: "Folio 3: Pantalla en Edificio B, Sala.",
      reportId: "r3",
      readAt: "2026-11-23T10:00:00.000Z",
    }),
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => feed,
  });
  vi.stubGlobal("fetch", fetchMock);
  push.mockReset();
  actions.markNotificationReadAction.mockReset();
  actions.markAllNotificationsReadAction.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderBell(initialFeed = feed) {
  render(
    <NotificationBell
      initialFeed={initialFeed}
      emptyHint="Aquí te avisamos cuando te asignen un reporte."
    />,
  );

  return screen.getByRole("button", { name: /^Avisos/ });
}

async function openPanel(bell: HTMLElement) {
  await act(async () => fireEvent.click(bell));

  return screen.getByRole("region", { name: "Avisos" });
}

describe("NotificationBell", () => {
  it("muestra el contador de no leídas y lo anuncia", () => {
    const bell = renderBell();

    expect(bell).toHaveAccessibleName("Avisos: 2 sin leer");
    expect(bell).toHaveTextContent("2");
    expect(bell).toHaveAttribute("aria-expanded", "false");
  });

  it("sin no leídas no muestra contador", () => {
    const bell = renderBell({ unreadCount: 0, items: [] });

    expect(bell).toHaveAccessibleName("Avisos");
    expect(bell).toHaveTextContent("");
  });

  it("limita el contador visible a 9+", () => {
    const bell = renderBell({ ...feed, unreadCount: 14 });

    expect(bell).toHaveTextContent("9+");
    expect(bell).toHaveAccessibleName("Avisos: 14 sin leer");
  });

  it("abre la lista con cada aviso enlazado a su reporte", async () => {
    const bell = renderBell();
    const panel = await openPanel(bell);

    expect(bell).toHaveAttribute("aria-expanded", "true");
    const links = within(panel).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/reportes/r12",
      "/reportes/r9",
      "/reportes/r3",
    ]);
    expect(links[0]).toHaveTextContent("Reporte nuevo, sin leer");
    expect(links[0]).toHaveTextContent("Folio 12: PC de laboratorio");
    expect(links[1]).toHaveTextContent("Reporte resuelto, sin leer");
    expect(links[2]).not.toHaveTextContent("sin leer");
    expect(
      within(panel).getByRole("button", { name: "Marcar todos como leídos" }),
    ).toBeInTheDocument();
  });

  it("sin avisos explica qué llegará ahí", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 0, items: [] }),
    });
    const panel = await openPanel(renderBell({ unreadCount: 0, items: [] }));

    expect(panel).toHaveTextContent("No tienes avisos.");
    expect(panel).toHaveTextContent("cuando te asignen un reporte");
    expect(
      within(panel).queryByRole("button", { name: /Marcar todos/ }),
    ).not.toBeInTheDocument();
  });

  it("al abrir un aviso no leído lo marca y luego va al reporte", async () => {
    actions.markNotificationReadAction.mockResolvedValue({
      unreadCount: 1,
      items: feed.items.map((entry) =>
        entry.id === "n1"
          ? { ...entry, readAt: "2026-11-24T17:00:00Z" }
          : entry,
      ),
    });
    const bell = renderBell();
    const panel = await openPanel(bell);

    await act(async () =>
      fireEvent.click(within(panel).getAllByRole("link")[0]),
    );

    expect(actions.markNotificationReadAction).toHaveBeenCalledWith("n1");
    expect(push).toHaveBeenCalledWith("/reportes/r12");
    expect(bell).toHaveAccessibleName("Avisos: 1 sin leer");
    expect(screen.queryByRole("region", { name: "Avisos" })).toBeNull();
  });

  it("marcar todos deja el contador en cero", async () => {
    actions.markAllNotificationsReadAction.mockResolvedValue({
      unreadCount: 0,
      items: [],
    });
    const bell = renderBell();
    const panel = await openPanel(bell);

    await act(async () =>
      fireEvent.click(
        within(panel).getByRole("button", { name: "Marcar todos como leídos" }),
      ),
    );

    expect(actions.markAllNotificationsReadAction).toHaveBeenCalledOnce();
    expect(bell).toHaveAccessibleName("Avisos");
  });

  it("consulta el endpoint cada 30 s y actualiza el contador", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ unreadCount: 5, items: feed.items }),
    });
    const bell = renderBell();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_MS);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications", {
      cache: "no-store",
    });
    expect(bell).toHaveAccessibleName("Avisos: 5 sin leer");
  });

  it("si el endpoint falla, conserva lo que ya mostraba", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const bell = renderBell();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_MS);
    });

    expect(bell).toHaveAccessibleName("Avisos: 2 sin leer");
  });

  it("Escape cierra la lista y devuelve el foco a la campana", async () => {
    const bell = renderBell();
    await openPanel(bell);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("region", { name: "Avisos" })).toBeNull();
    expect(bell).toHaveFocus();
  });
});
