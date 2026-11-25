import { hashPassword } from "better-auth/crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReportStatus, UserRole } from "@/generated/prisma/enums";
import EditAssetPage from "@/app/(staff)/activos/[id]/editar/page";
import AssetQrPage from "@/app/(staff)/activos/[id]/qr/page";
import NewAssetPage from "@/app/(staff)/activos/nuevo/page";
import AssetsPage from "@/app/(staff)/activos/page";
import MyReportsPage from "@/app/(staff)/mis-reportes/page";
import ReportPage from "@/app/(staff)/reportes/[id]/page";
import ReportsPage from "@/app/(staff)/reportes/page";
import LocationsPage from "@/app/(staff)/ubicaciones/page";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { AssetSheet } from "@/components/assets/asset-sheet";
import { ReportSheet } from "@/components/reports/report-sheet";
import { generatePublicCode } from "@/lib/public-code";
import { createAssetAction, updateAssetAction } from "@/server/assets/actions";
import { auth } from "@/server/auth/auth";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import {
  createLocationAction,
  updateLocationAction,
} from "@/server/locations/actions";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/notifications/actions";
import {
  assignReportAction,
  commentReportAction,
  rejectReportAction,
  resolveReportAction,
  setReportPriorityAction,
  startReportAction,
  submitReportAction,
} from "@/server/reports/actions";
import {
  assignReport,
  changeReportStatus,
  createReport,
} from "@/server/reports/service";
import { resetDb } from "./reset-db";

// Matriz de permisos de punta a punta (Fase 11): cada página, endpoint y Server
// Action contra cada perfil, con sesiones reales de Better Auth. Los guardas
// (getSession, requireUser, requirePagePermission) no se simulan; solo los
// puntos de entrada de Next (cookies, redirect, notFound, revalidatePath).

const request = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({ get: vi.fn(), set: vi.fn() }),
}));

class NavigationSignal extends Error {
  constructor(readonly target: string) {
    super(target);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new NavigationSignal(url);
  },
  notFound: () => {
    throw new NavigationSignal("not-found");
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const BASE_URL = "http://localhost:3000";
const PASSWORD = "contrasena-de-la-matriz";

const PROFILES = [
  "anonymous",
  "inactive",
  "staff",
  "technician",
  "otherTechnician",
  "admin",
] as const;

type Profile = (typeof PROFILES)[number];

const profileLabels: Record<Profile, string> = {
  anonymous: "anónimo",
  inactive: "cuenta desactivada con sesión abierta",
  staff: "Administrativo",
  technician: "Técnico asignado",
  otherTechnician: "otro Técnico",
  admin: "ADMIN",
};

type Account = { id: string; cookie: string; viewer: NonNullable<Viewer> };

const accounts = {} as Record<Exclude<Profile, "anonymous">, Account>;

async function createAccount(
  key: Exclude<Profile, "anonymous">,
  role: UserRole,
) {
  const user = await db.user.create({
    data: {
      name: profileLabels[key],
      email: `${key.toLowerCase()}@matriz.test`,
      role,
      emailVerified: true,
    },
  });
  await db.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(PASSWORD),
    },
  });

  const response = await auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email: user.email, password: PASSWORD }),
    }),
  );
  expect(response.status).toBe(200);

  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  accounts[key] = {
    id: user.id,
    cookie,
    viewer: { id: user.id, role, isActive: true },
  };
}

function actAs(profile: Profile) {
  request.headers =
    profile === "anonymous"
      ? new Headers()
      : new Headers({ cookie: accounts[profile].cookie });
}

type Outcome =
  | { kind: "redirect"; target: string }
  | { kind: "not-found" }
  | { kind: "value"; value: unknown };

async function outcomeOf(run: () => unknown): Promise<Outcome> {
  try {
    return { kind: "value", value: await run() };
  } catch (error) {
    if (error instanceof NavigationSignal) {
      return error.target === "not-found"
        ? { kind: "not-found" }
        : { kind: "redirect", target: error.target };
    }

    throw error;
  }
}

function form(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) data.set(key, value);

  return data;
}

let locationId: string;

async function newAsset() {
  const unique = generatePublicCode();
  const asset = await db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: `INV-${unique}`,
      name: "Proyector de la matriz",
      type: "PROJECTOR",
      serialNumber: `SERIE-${unique}`,
      locationId,
    },
  });

  return asset;
}

// Un reporte nuevo por caso, para que ninguna acción dependa de la anterior.
async function newReport(
  status: Extract<
    ReportStatus,
    "REPORTED" | "ASSIGNED" | "IN_PROGRESS"
  > = "REPORTED",
) {
  const asset = await newAsset();
  const admin = accounts.admin.viewer;
  const created = await createReport(admin, asset.publicCode, {
    description: "No enciende",
  });
  if (!created.ok) throw new Error("No se creó el reporte.");
  const id = created.data.id;

  if (status !== "REPORTED") {
    await assignReport(admin, id, { technicianId: accounts.technician.id });
  }
  if (status === "IN_PROGRESS") {
    await changeReportStatus(accounts.technician.viewer, id, {
      status: "IN_PROGRESS",
    });
  }

  return { id, asset };
}

const reportAfter = (id: string) =>
  db.report.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  await resetDb();
  await createAccount("inactive", "ADMIN");
  await createAccount("staff", "STAFF");
  await createAccount("technician", "TECHNICIAN");
  await createAccount("otherTechnician", "TECHNICIAN");
  await createAccount("admin", "ADMIN");
  // Se desactiva después de iniciar sesión: su cookie sigue existiendo.
  await db.user.update({
    where: { id: accounts.inactive.id },
    data: { isActive: false },
  });

  locationId = (
    await db.location.create({
      data: { building: "Edificio M", room: "Aula de la matriz" },
    })
  ).id;
});
afterAll(() => db.$disconnect());

// ─── Páginas del área de staff ────────────────────────────────────────────────

type PageExpectation = "render" | "login" | "not-found" | `→ ${string}`;

type PageCase = {
  route: string;
  render: (ids: { assetId: string; reportId: string }) => Promise<unknown>;
  expected: Record<Profile, PageExpectation>;
};

const LOGIN_ONLY = { anonymous: "login", inactive: "login" } as const;
const ADMIN_ONLY = {
  ...LOGIN_ONLY,
  staff: "→ /reportes",
  technician: "→ /reportes",
  otherTechnician: "→ /reportes",
  admin: "render",
} as const;

const props = <T>(params: T, searchParams: Record<string, string> = {}) =>
  ({
    params: Promise.resolve(params),
    searchParams: Promise.resolve(searchParams),
  }) as never;

const pageCases: PageCase[] = [
  {
    route: "/reportes",
    render: () => ReportsPage(props({})),
    expected: {
      ...LOGIN_ONLY,
      staff: "render",
      technician: "→ /mis-reportes",
      otherTechnician: "→ /mis-reportes",
      admin: "render",
    },
  },
  {
    route: "/reportes/[id]",
    render: ({ reportId }) => ReportPage(props({ id: reportId })),
    expected: {
      ...LOGIN_ONLY,
      staff: "render",
      technician: "render",
      otherTechnician: "not-found",
      admin: "render",
    },
  },
  {
    route: "/mis-reportes",
    render: () => MyReportsPage(),
    expected: {
      ...LOGIN_ONLY,
      staff: "→ /reportes",
      technician: "render",
      otherTechnician: "render",
      admin: "→ /reportes",
    },
  },
  {
    route: "/activos",
    render: () => AssetsPage(props({})),
    expected: ADMIN_ONLY,
  },
  {
    route: "/activos/nuevo",
    render: () => NewAssetPage(),
    expected: ADMIN_ONLY,
  },
  {
    route: "/activos/[id]/editar",
    render: ({ assetId }) => EditAssetPage(props({ id: assetId })),
    expected: ADMIN_ONLY,
  },
  {
    route: "/activos/[id]/qr",
    render: ({ assetId }) => AssetQrPage(props({ id: assetId })),
    expected: ADMIN_ONLY,
  },
  {
    route: "/ubicaciones",
    render: () => LocationsPage(),
    expected: ADMIN_ONLY,
  },
];

describe("páginas del área de staff", () => {
  let ids: { assetId: string; reportId: string };

  beforeAll(async () => {
    const { id, asset } = await newReport("ASSIGNED");
    ids = { assetId: asset.id, reportId: id };
  });

  describe.each(pageCases)("$route", ({ render, expected }) => {
    it.each(PROFILES)("%s", async (profile) => {
      actAs(profile);
      const outcome = await outcomeOf(() => render(ids));
      const want = expected[profile];

      if (want === "render") {
        expect(outcome.kind).toBe("value");
      } else if (want === "login") {
        expect(outcome).toEqual({ kind: "redirect", target: "/login" });
      } else if (want === "not-found") {
        expect(outcome).toEqual({ kind: "not-found" });
      } else {
        expect(outcome).toEqual({ kind: "redirect", target: want.slice(2) });
      }
    });
  });
});

// ─── Páginas públicas ─────────────────────────────────────────────────────────

describe("ficha pública y formulario de reporte", () => {
  let code: string;
  let inventoryNumber: string;
  let serialNumber: string;

  beforeAll(async () => {
    const { asset } = await newReport("ASSIGNED");
    code = asset.publicCode;
    inventoryNumber = asset.inventoryNumber;
    serialNumber = asset.serialNumber ?? "";
  });

  const seesStaffDetails: Record<Profile, boolean> = {
    anonymous: false,
    inactive: false,
    staff: true,
    technician: true,
    otherTechnician: true,
    admin: true,
  };

  it.each(PROFILES)(
    "/a/[code] · %s abre la ficha; solo el personal ve inventario y serie",
    async (profile) => {
      actAs(profile);
      const html = renderToStaticMarkup(await AssetSheet(props({ code })));

      expect(html).toContain("Proyector de la matriz");
      expect(html).toContain(`/a/${code}/reportar`);
      expect(html.includes(inventoryNumber)).toBe(seesStaffDetails[profile]);
      expect(html.includes(serialNumber)).toBe(seesStaffDetails[profile]);
      expect(html.includes(profileLabels.technician)).toBe(
        seesStaffDetails[profile],
      );
    },
  );

  it.each(PROFILES)(
    "/a/[code]/reportar · %s abre el formulario",
    async (profile) => {
      actAs(profile);
      const html = renderToStaticMarkup(await ReportSheet(props({ code })));

      expect(html).toContain("Proyector de la matriz");
      expect(html).not.toContain(inventoryNumber);
      expect(html).not.toContain(serialNumber);
    },
  );
});

// ─── Endpoint de avisos ───────────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  beforeAll(async () => {
    // Cada perfil con cuenta tiene un aviso propio (y solo ese).
    const { id: reportId } = await newReport();
    await db.notification.deleteMany();

    for (const account of Object.values(accounts)) {
      await db.notification.create({
        data: {
          recipientId: account.id,
          reportId,
          type: "REPORT_CREATED",
          message: `Aviso de ${account.id}`,
        },
      });
    }
  });

  const status: Record<Profile, number> = {
    anonymous: 401,
    inactive: 401,
    staff: 200,
    technician: 200,
    otherTechnician: 200,
    admin: 200,
  };

  it.each(PROFILES)("%s", async (profile) => {
    actAs(profile);
    const response = await getNotifications();

    expect(response.status).toBe(status[profile]);
    expect(response.headers.get("cache-control")).toBe("no-store");

    if (response.status === 200) {
      const own = accounts[profile as Exclude<Profile, "anonymous">].id;
      const body = (await response.json()) as {
        items: { message: string }[];
      };

      expect(body.items.map((item) => item.message)).toEqual([
        `Aviso de ${own}`,
      ]);
    }
  });
});

// ─── Server Actions ───────────────────────────────────────────────────────────

type ActionExpectation = "allowed" | "denied" | "login";

type ActionCase = {
  action: string;
  // Prepara datos nuevos y devuelve cómo ejecutar la acción y cómo saber si cambió algo.
  arrange: (profile: Profile) => Promise<{
    run: () => Promise<unknown>;
    changed: () => Promise<boolean>;
    internalIds: string[];
  }>;
  expected: Record<Profile, ActionExpectation>;
};

const ADMIN_ACTION = {
  anonymous: "login",
  inactive: "login",
  staff: "denied",
  technician: "denied",
  otherTechnician: "denied",
  admin: "allowed",
} as const;

const WORK_ACTION = {
  anonymous: "login",
  inactive: "login",
  staff: "denied",
  technician: "allowed",
  otherTechnician: "denied",
  admin: "allowed",
} as const;

const initial = { ok: false } as const;

const actionCases: ActionCase[] = [
  {
    action: "assignReportAction",
    arrange: async () => {
      const { id } = await newReport();

      return {
        run: () =>
          assignReportAction(
            id,
            initial,
            form({ technicianId: accounts.technician.id }),
          ),
        changed: async () => (await reportAfter(id)).status !== "REPORTED",
        internalIds: [id, accounts.technician.id],
      };
    },
    expected: ADMIN_ACTION,
  },
  {
    action: "setReportPriorityAction",
    arrange: async () => {
      const { id } = await newReport();

      return {
        run: () =>
          setReportPriorityAction(id, initial, form({ priority: "HIGH" })),
        changed: async () => (await reportAfter(id)).priority === "HIGH",
        internalIds: [id],
      };
    },
    expected: ADMIN_ACTION,
  },
  {
    action: "rejectReportAction",
    arrange: async () => {
      const { id } = await newReport("ASSIGNED");

      return {
        run: () =>
          rejectReportAction(id, initial, form({ reason: "Duplicado" })),
        changed: async () => (await reportAfter(id)).status === "REJECTED",
        internalIds: [id],
      };
    },
    expected: ADMIN_ACTION,
  },
  {
    action: "startReportAction",
    arrange: async () => {
      const { id } = await newReport("ASSIGNED");

      return {
        run: () => startReportAction(id, initial, form({ note: "" })),
        changed: async () => (await reportAfter(id)).status === "IN_PROGRESS",
        internalIds: [id],
      };
    },
    expected: WORK_ACTION,
  },
  {
    action: "resolveReportAction",
    arrange: async () => {
      const { id } = await newReport("IN_PROGRESS");

      return {
        run: () =>
          resolveReportAction(id, initial, form({ note: "Cambio de lámpara" })),
        changed: async () => (await reportAfter(id)).status === "RESOLVED",
        internalIds: [id],
      };
    },
    expected: WORK_ACTION,
  },
  {
    action: "commentReportAction",
    arrange: async () => {
      const { id } = await newReport("IN_PROGRESS");
      const count = () =>
        db.reportEvent.count({ where: { reportId: id, type: "COMMENT" } });

      return {
        run: () =>
          commentReportAction(id, initial, form({ message: "Pedí la pieza" })),
        changed: async () => (await count()) > 0,
        internalIds: [id],
      };
    },
    expected: WORK_ACTION,
  },
  {
    action: "submitReportAction",
    arrange: async () => {
      const asset = await newAsset();

      return {
        run: () =>
          submitReportAction(
            asset.publicCode,
            initial,
            form({ description: "La imagen parpadea" }),
          ),
        changed: async () =>
          (await db.report.count({ where: { assetId: asset.id } })) === 1,
        internalIds: [asset.id],
      };
    },
    expected: {
      anonymous: "allowed",
      inactive: "allowed",
      staff: "allowed",
      technician: "allowed",
      otherTechnician: "allowed",
      admin: "allowed",
    },
  },
  {
    action: "createAssetAction",
    arrange: async (profile) => {
      const inventoryNumber = `NUEVO-${profile}`;

      return {
        run: () =>
          createAssetAction(
            initial,
            form({
              inventoryNumber,
              name: "Monitor nuevo",
              type: "DISPLAY",
              locationId,
            }),
          ),
        changed: async () =>
          (await db.asset.count({ where: { inventoryNumber } })) === 1,
        internalIds: [locationId],
      };
    },
    expected: ADMIN_ACTION,
  },
  {
    action: "updateAssetAction",
    arrange: async () => {
      const asset = await newAsset();

      return {
        run: () =>
          updateAssetAction(
            asset.id,
            initial,
            form({
              inventoryNumber: asset.inventoryNumber,
              name: "Nombre editado",
              type: "PROJECTOR",
              locationId,
            }),
          ),
        changed: async () =>
          (await db.asset.findUniqueOrThrow({ where: { id: asset.id } }))
            .name === "Nombre editado",
        internalIds: [asset.id, locationId],
      };
    },
    expected: ADMIN_ACTION,
  },
  {
    action: "createLocationAction",
    arrange: async (profile) => {
      const room = `Aula creada por ${profile}`;

      return {
        run: () =>
          createLocationAction(initial, form({ building: "Edificio N", room })),
        changed: async () =>
          (await db.location.count({ where: { room } })) === 1,
        internalIds: [],
      };
    },
    expected: ADMIN_ACTION,
  },
  {
    action: "updateLocationAction",
    arrange: async (profile) => {
      const building = `Edificio de ${profile}`;
      const location = await db.location.create({
        data: { building, room: "Aula original" },
      });

      return {
        run: () =>
          updateLocationAction(
            location.id,
            initial,
            form({ building, room: "Aula renombrada" }),
          ),
        changed: async () =>
          (await db.location.findUniqueOrThrow({ where: { id: location.id } }))
            .room === "Aula renombrada",
        internalIds: [location.id],
      };
    },
    expected: ADMIN_ACTION,
  },
  {
    // Solo quien recibió el aviso puede marcarlo; los demás no cambian nada.
    action: "markNotificationReadAction",
    arrange: async () => {
      const { id: reportId } = await newReport();
      const notification = await db.notification.create({
        data: {
          recipientId: accounts.technician.id,
          reportId,
          type: "REPORT_ASSIGNED",
          message: "Aviso del técnico",
        },
      });

      return {
        run: () => markNotificationReadAction(notification.id),
        changed: async () =>
          (
            await db.notification.findUniqueOrThrow({
              where: { id: notification.id },
            })
          ).readAt !== null,
        internalIds: [],
      };
    },
    expected: {
      anonymous: "login",
      inactive: "login",
      staff: "denied",
      technician: "allowed",
      otherTechnician: "denied",
      admin: "denied",
    },
  },
  {
    // Marca solo los avisos propios: el del ADMIN queda sin leer salvo para él.
    action: "markAllNotificationsReadAction",
    arrange: async () => {
      const { id: reportId } = await newReport();
      const notification = await db.notification.create({
        data: {
          recipientId: accounts.admin.id,
          reportId,
          type: "REPORT_CREATED",
          message: "Aviso del ADMIN",
        },
      });

      return {
        run: () => markAllNotificationsReadAction(),
        changed: async () =>
          (
            await db.notification.findUniqueOrThrow({
              where: { id: notification.id },
            })
          ).readAt !== null,
        internalIds: [],
      };
    },
    expected: {
      anonymous: "login",
      inactive: "login",
      staff: "denied",
      technician: "denied",
      otherTechnician: "denied",
      admin: "allowed",
    },
  },
];

function isRejectedForm(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === false &&
    "message" in value &&
    typeof value.message === "string"
  );
}

describe("Server Actions", () => {
  it("la matriz cubre cada acción de los módulos de acciones", async () => {
    const modules = await Promise.all([
      import("@/server/assets/actions"),
      import("@/server/locations/actions"),
      import("@/server/notifications/actions"),
      import("@/server/reports/actions"),
    ]);
    const exported = modules.flatMap((module) =>
      Object.entries(module)
        .filter(([, value]) => typeof value === "function")
        .map(([name]) => name),
    );

    expect(actionCases.map(({ action }) => action).sort()).toEqual(
      exported.sort(),
    );
  });

  describe.each(actionCases)("$action", ({ arrange, expected }) => {
    it.each(PROFILES)("%s", async (profile) => {
      const { run, changed, internalIds } = await arrange(profile);
      actAs(profile);
      const outcome = await outcomeOf(run);
      const want = expected[profile];

      if (want === "login") {
        expect(outcome).toEqual({ kind: "redirect", target: "/login" });
        expect(await changed()).toBe(false);

        return;
      }

      expect(outcome).not.toEqual({ kind: "redirect", target: "/login" });
      expect(await changed()).toBe(want === "allowed");

      if (want === "denied" && outcome.kind === "value") {
        // Las acciones de formulario explican el rechazo sin exponer ids internos.
        if (
          typeof outcome.value === "object" &&
          outcome.value !== null &&
          "ok" in outcome.value
        ) {
          expect(isRejectedForm(outcome.value)).toBe(true);
        }

        const serialized = JSON.stringify(outcome.value);
        for (const id of internalIds) expect(serialized).not.toContain(id);
      }
    });
  });
});
