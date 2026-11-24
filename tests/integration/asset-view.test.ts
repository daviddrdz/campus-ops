import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { AssetSheet } from "@/components/assets/asset-sheet";
import { getAssetLabel } from "@/server/assets/service";
import { getAssetView } from "@/server/assets/view";
import { AuthorizationError } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { resetDb } from "./reset-db";

const session = vi.hoisted(() => ({
  user: null as null | { id: string; role: string; isActive: boolean },
}));

vi.mock("@/server/auth/session", () => ({
  getSession: async () => session.user,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const PUBLIC_CODE = "abc234def567";
const PUBLIC_FIELDS = [
  "brand",
  "location",
  "model",
  "name",
  "specifications",
  "status",
  "type",
];

const privateValues = {
  inventoryNumber: "INV-PRIVADO-77",
  serialNumber: "SERIE-PRIVADA-77",
  technicianName: "Persona Técnica Privada",
  technicianEmail: "tecnico-privado@campusops.test",
  reporterName: "Persona Reportante Privada",
  reporterEmail: "reporta-privado@campusops.test",
  reporterIpHash: "hash-ip-privado",
  description: "Descripción privada del reporte",
  resolutionNote: "Nota privada de resolución",
  eventMessage: "Comentario privado de la bitácora",
};

async function seedAssetWithHistory() {
  const location = await db.location.create({
    data: { building: "Edificio A", room: "Laboratorio 2" },
  });
  const technician = await db.user.create({
    data: {
      name: privateValues.technicianName,
      email: privateValues.technicianEmail,
      role: "TECHNICIAN",
    },
  });
  const asset = await db.asset.create({
    data: {
      publicCode: PUBLIC_CODE,
      inventoryNumber: privateValues.inventoryNumber,
      serialNumber: privateValues.serialNumber,
      name: "PC de laboratorio",
      type: "COMPUTER",
      brand: "Dell",
      model: "OptiPlex",
      specifications: "16 GB RAM",
      status: "IN_MAINTENANCE",
      locationId: location.id,
    },
  });
  const report = await db.report.create({
    data: {
      assetId: asset.id,
      description: privateValues.description,
      status: "IN_PROGRESS",
      reporterName: privateValues.reporterName,
      reporterEmail: privateValues.reporterEmail,
      reporterIpHash: privateValues.reporterIpHash,
      assignedToId: technician.id,
      resolutionNote: privateValues.resolutionNote,
    },
  });

  await db.reportEvent.create({
    data: {
      reportId: report.id,
      type: "COMMENT",
      actorId: technician.id,
      message: privateValues.eventMessage,
    },
  });

  return { asset, location, report, technician };
}

function expectNoPrivateData(content: string, internalIds: string[]) {
  for (const value of [...Object.values(privateValues), ...internalIds]) {
    expect(content).not.toContain(value);
  }
}

const viewerWith = (role: UserRole): Viewer => ({
  id: `usuario-${role}`,
  role,
  isActive: true,
});

describe("ficha pública del activo", () => {
  beforeEach(async () => {
    await resetDb();
    session.user = null;
  });
  afterAll(() => db.$disconnect());

  describe("no filtración", () => {
    const publicViewers: [string, Viewer][] = [
      ["anónimo", null],
      ["cuenta inactiva", { id: "inactivo", role: "ADMIN", isActive: false }],
    ];

    it.each(publicViewers)(
      "el DTO para %s trae solo los campos permitidos",
      async (_name, viewer) => {
        const { asset, location, report, technician } =
          await seedAssetWithHistory();

        const view = await getAssetView(PUBLIC_CODE, viewer);

        expect(view).not.toBeNull();
        expect(Object.keys(view ?? {}).sort()).toEqual(PUBLIC_FIELDS);
        expect(Object.keys(view?.location ?? {}).sort()).toEqual([
          "building",
          "room",
        ]);
        expectNoPrivateData(JSON.stringify(view), [
          asset.id,
          location.id,
          report.id,
          technician.id,
        ]);
      },
    );

    it("la página renderizada para un anónimo no contiene datos privados", async () => {
      const { asset, location, report, technician } =
        await seedAssetWithHistory();

      const html = renderToStaticMarkup(
        await AssetSheet({ params: Promise.resolve({ code: PUBLIC_CODE }) }),
      );

      expect(html).toContain("PC de laboratorio");
      expect(html).toContain("En mantenimiento");
      expect(html).toContain(`/a/${PUBLIC_CODE}/reportar`);
      expectNoPrivateData(html, [
        asset.id,
        location.id,
        report.id,
        technician.id,
      ]);
    });
  });

  describe("código desconocido", () => {
    it("devuelve null con un código bien formado que no existe", async () => {
      await seedAssetWithHistory();

      await expect(getAssetView("zzz234def567", null)).resolves.toBeNull();
    });

    it.each(["", "corto", "ABC234DEF567", "abc234def5670", "abc234def56l"])(
      "devuelve null con el código mal formado %j",
      async (code) => {
        await expect(getAssetView(code, null)).resolves.toBeNull();
      },
    );

    it("no acepta el id interno como código", async () => {
      const { asset } = await seedAssetWithHistory();

      await expect(getAssetView(asset.id, null)).resolves.toBeNull();
    });

    it("la página responde con la pantalla 404", async () => {
      await expect(
        AssetSheet({ params: Promise.resolve({ code: "zzz234def567" }) }),
      ).rejects.toThrow("NOT_FOUND");
    });
  });

  describe("etiqueta QR", () => {
    it("el ADMIN obtiene nombre, ubicación y código público", async () => {
      const { asset } = await seedAssetWithHistory();

      await expect(
        getAssetLabel(viewerWith("ADMIN"), asset.id),
      ).resolves.toEqual({
        id: asset.id,
        publicCode: PUBLIC_CODE,
        name: "PC de laboratorio",
        location: { building: "Edificio A", room: "Laboratorio 2" },
      });
    });

    it.each<[string, Viewer]>([
      ["anónimo", null],
      ["administrativo", viewerWith("STAFF")],
      ["técnico", viewerWith("TECHNICIAN")],
    ])("%s no puede obtenerla", async (_name, viewer) => {
      const { asset } = await seedAssetWithHistory();

      await expect(getAssetLabel(viewer, asset.id)).rejects.toThrow(
        AuthorizationError,
      );
    });

    it("devuelve null si el activo no existe", async () => {
      await expect(
        getAssetLabel(viewerWith("ADMIN"), "no-existe"),
      ).resolves.toBeNull();
    });
  });
});
