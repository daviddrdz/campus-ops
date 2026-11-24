import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { generatePublicCode } from "@/lib/public-code";
import { AuthorizationError } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import {
  AssetNotFoundError,
  InvalidAssigneeError,
  InvalidTransitionError,
  ReportConflictError,
  ReportDomainError,
  ReportNotFoundError,
} from "@/server/reports/errors";
import {
  assignReport,
  changeReportStatus,
  createReport,
  rejectReport,
} from "@/server/reports/service";
import { resetDb } from "./reset-db";

type NonNullViewer = NonNullable<Viewer>;

let sequence = 0;

async function newUser(
  role: UserRole,
  isActive = true,
): Promise<NonNullViewer> {
  const n = ++sequence;
  const user = await db.user.create({
    data: { name: `${role} ${n}`, email: `u${n}@test.mx`, role, isActive },
  });

  return { id: user.id, role: user.role, isActive: user.isActive };
}

async function newAsset() {
  const n = ++sequence;
  const location = await db.location.create({
    data: { building: "Edificio A", room: `Aula ${n}` },
  });

  return db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: `INV-${n}`,
      name: `Equipo ${n}`,
      type: "COMPUTER",
      locationId: location.id,
    },
  });
}

let admin: NonNullViewer;
let tech: NonNullViewer;
let otherTech: NonNullViewer;
let staff: NonNullViewer;
let asset: Awaited<ReturnType<typeof newAsset>>;

const ghostAdmin: Viewer = { id: "no-existe", role: "ADMIN", isActive: true };

async function reported(description = "No enciende", viewer: Viewer = null) {
  const result = await createReport(viewer, asset.publicCode, { description });

  if (!result.ok) throw new Error("No se pudo crear el reporte de prueba.");

  return result.data.id;
}

async function ok<T>(promise: Promise<{ ok: boolean; data?: T }>) {
  const result = await promise;

  if (!result.ok) throw new Error(`Falló: ${JSON.stringify(result)}`);

  return result.data as T;
}

async function assigned(technician = tech) {
  const id = await reported();
  await ok(assignReport(admin, id, { technicianId: technician.id }));

  return id;
}

async function inProgress(technician = tech) {
  const id = await assigned(technician);
  await ok(changeReportStatus(technician, id, { status: "IN_PROGRESS" }));

  return id;
}

const assetStatus = async (id = asset.id) =>
  (await db.asset.findUniqueOrThrow({ where: { id } })).status;

const reportOf = (id: string) => db.report.findUniqueOrThrow({ where: { id } });

const eventsOf = (reportId: string) =>
  db.reportEvent.findMany({
    where: { reportId },
    orderBy: { createdAt: "asc" },
  });

async function snapshot(reportId: string) {
  const { status, assignedToId, resolutionNote, updatedAt } =
    await reportOf(reportId);

  return {
    report: { status, assignedToId, resolutionNote, updatedAt },
    asset: await assetStatus(),
    events: (await eventsOf(reportId)).length,
  };
}

describe("dominio de reportes", () => {
  beforeEach(async () => {
    await resetDb();
    [admin, tech, otherTech, staff] = await Promise.all([
      newUser("ADMIN"),
      newUser("TECHNICIAN"),
      newUser("TECHNICIAN"),
      newUser("STAFF"),
    ]);
    asset = await newAsset();
  });
  afterAll(() => db.$disconnect());

  describe("createReport", () => {
    it("un anónimo crea un reporte con su evento y el activo cambia", async () => {
      const result = await createReport(
        null,
        asset.publicCode,
        {
          description: "  La pantalla parpadea ",
          faultType: "HARDWARE",
          reporterName: "Ana",
          reporterEmail: "ana@escuela.mx",
        },
        { reporterIpHash: "hash-de-ip" },
      );

      expect(result).toMatchObject({ ok: true, data: { folio: 1 } });
      const id = (result as { data: { id: string } }).data.id;
      await expect(reportOf(id)).resolves.toMatchObject({
        assetId: asset.id,
        description: "La pantalla parpadea",
        faultType: "HARDWARE",
        reporterName: "Ana",
        reporterEmail: "ana@escuela.mx",
        reporterIpHash: "hash-de-ip",
        status: "REPORTED",
        priority: "MEDIUM",
        assignedToId: null,
      });
      await expect(eventsOf(id)).resolves.toEqual([
        expect.objectContaining({
          type: "CREATED",
          actorId: null,
          fromStatus: null,
          toStatus: "REPORTED",
          assigneeId: null,
        }),
      ]);
      await expect(assetStatus()).resolves.toBe("FAULT_REPORTED");
    });

    it("registra como actor al usuario con sesión", async () => {
      const id = await reported("Falla", staff);

      await expect(eventsOf(id)).resolves.toEqual([
        expect.objectContaining({ actorId: staff.id }),
      ]);
    });

    it("ignora estado, prioridad y técnico enviados por el cliente", async () => {
      const result = await createReport(null, asset.publicCode, {
        description: "Falla",
        status: "RESOLVED",
        priority: "HIGH",
        assignedToId: tech.id,
      });

      const id = (result as { data: { id: string } }).data.id;
      await expect(reportOf(id)).resolves.toMatchObject({
        status: "REPORTED",
        priority: "MEDIUM",
        assignedToId: null,
      });
    });

    it("asigna folios consecutivos", async () => {
      await reported();
      const second = await reported();

      await expect(reportOf(second)).resolves.toMatchObject({ folio: 2 });
    });

    it.each([
      ["inexistente", "zzzzzzzzzzzz"],
      ["con formato inválido", "../../admin"],
      ["que no es texto", 42],
    ])("rechaza un código de activo %s sin crear nada", async (_n, code) => {
      await expect(
        createReport(null, code, { description: "Falla" }),
      ).rejects.toBeInstanceOf(AssetNotFoundError);
      await expect(db.report.count()).resolves.toBe(0);
    });

    it("devuelve errores de validación sin tocar la base", async () => {
      await expect(
        createReport(null, asset.publicCode, { description: " " }),
      ).resolves.toEqual({
        ok: false,
        fieldErrors: { description: "Describe la falla." },
      });
      await expect(db.report.count()).resolves.toBe(0);
      await expect(assetStatus()).resolves.toBe("OPERATIONAL");
    });

    it("soporta reportes simultáneos del mismo activo", async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          createReport(null, asset.publicCode, { description: "Falla" }),
        ),
      );

      expect(results.every((result) => result.ok)).toBe(true);
      await expect(db.report.count()).resolves.toBe(5);
      await expect(assetStatus()).resolves.toBe("FAULT_REPORTED");
    });
  });

  describe("assignReport", () => {
    it("el admin asigna un reporte nuevo", async () => {
      const id = await reported();

      const result = await assignReport(admin, id, { technicianId: tech.id });

      expect(result).toMatchObject({
        ok: true,
        data: { id, status: "ASSIGNED", assetStatus: "FAULT_REPORTED" },
      });
      const report = await reportOf(id);
      expect(report).toMatchObject({
        status: "ASSIGNED",
        assignedToId: tech.id,
      });
      expect(report.assignedAt).toBeInstanceOf(Date);
      expect((await eventsOf(id)).at(-1)).toMatchObject({
        type: "ASSIGNED",
        actorId: admin.id,
        assigneeId: tech.id,
        fromStatus: "REPORTED",
        toStatus: "ASSIGNED",
      });
    });

    it("reasignar un reporte en proceso conserva el estado", async () => {
      const id = await inProgress();

      await ok(assignReport(admin, id, { technicianId: otherTech.id }));

      await expect(reportOf(id)).resolves.toMatchObject({
        status: "IN_PROGRESS",
        assignedToId: otherTech.id,
      });
      await expect(assetStatus()).resolves.toBe("IN_MAINTENANCE");
      expect((await eventsOf(id)).at(-1)).toMatchObject({
        type: "ASSIGNED",
        assigneeId: otherTech.id,
        fromStatus: "IN_PROGRESS",
        toStatus: "IN_PROGRESS",
      });
    });

    it("el técnico reasignado pierde el reporte y el nuevo lo recibe", async () => {
      const id = await assigned();
      await ok(assignReport(admin, id, { technicianId: otherTech.id }));

      await expect(
        changeReportStatus(tech, id, { status: "IN_PROGRESS" }),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(
        changeReportStatus(otherTech, id, { status: "IN_PROGRESS" }),
      ).resolves.toMatchObject({ ok: true });
    });

    it("no reasigna al mismo técnico", async () => {
      const id = await assigned();
      const before = await snapshot(id);

      await expect(
        assignReport(admin, id, { technicianId: tech.id }),
      ).rejects.toBeInstanceOf(InvalidAssigneeError);
      await expect(snapshot(id)).resolves.toEqual(before);
    });

    it.each<[string, () => Promise<string>]>([
      ["un administrador", async () => admin.id],
      ["un administrativo", async () => staff.id],
      [
        "un técnico inactivo",
        async () => (await newUser("TECHNICIAN", false)).id,
      ],
      ["un usuario inexistente", async () => "no-existe"],
    ])("rechaza asignar a %s", async (_n, technicianId) => {
      const id = await reported();
      const before = await snapshot(id);

      await expect(
        assignReport(admin, id, { technicianId: await technicianId() }),
      ).rejects.toBeInstanceOf(InvalidAssigneeError);
      await expect(snapshot(id)).resolves.toEqual(before);
    });

    it.each<[string, () => Viewer]>([
      ["anónimo", () => null],
      ["administrativo", () => staff],
      ["técnico", () => tech],
      ["admin inactivo", () => ({ ...admin, isActive: false })],
    ])("%s no puede asignar", async (_n, viewer) => {
      const id = await reported();
      const before = await snapshot(id);

      await expect(
        assignReport(viewer(), id, { technicianId: tech.id }),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(snapshot(id)).resolves.toEqual(before);
    });

    it("no asigna un reporte cerrado", async () => {
      const id = await reported();
      await ok(rejectReport(admin, id, { reason: "Duplicado" }));

      await expect(
        assignReport(admin, id, { technicianId: tech.id }),
      ).rejects.toBeInstanceOf(InvalidTransitionError);
    });

    it("informa un reporte inexistente", async () => {
      await expect(
        assignReport(admin, "no-existe", { technicianId: tech.id }),
      ).rejects.toBeInstanceOf(ReportNotFoundError);
    });

    it("devuelve error de campo si falta el técnico", async () => {
      const id = await reported();

      await expect(assignReport(admin, id, {})).resolves.toEqual({
        ok: false,
        fieldErrors: { technicianId: "Elige un técnico." },
      });
    });
  });

  describe("changeReportStatus", () => {
    it("el técnico inicia su reporte y el activo entra a mantenimiento", async () => {
      const id = await assigned();

      const result = await changeReportStatus(tech, id, {
        status: "IN_PROGRESS",
        note: "Voy en camino",
      });

      expect(result).toMatchObject({
        ok: true,
        data: { status: "IN_PROGRESS", assetStatus: "IN_MAINTENANCE" },
      });
      expect((await eventsOf(id)).at(-1)).toMatchObject({
        type: "STATUS_CHANGED",
        actorId: tech.id,
        fromStatus: "ASSIGNED",
        toStatus: "IN_PROGRESS",
        message: "Voy en camino",
      });
    });

    it("el técnico resuelve con nota y el activo vuelve a funcionar", async () => {
      const id = await inProgress();

      await ok(
        changeReportStatus(tech, id, {
          status: "RESOLVED",
          note: "Cambié la fuente de poder",
        }),
      );

      const report = await reportOf(id);
      expect(report).toMatchObject({
        status: "RESOLVED",
        resolutionNote: "Cambié la fuente de poder",
      });
      expect(report.resolvedAt).toBeInstanceOf(Date);
      await expect(assetStatus()).resolves.toBe("OPERATIONAL");
      expect((await eventsOf(id)).at(-1)).toMatchObject({
        fromStatus: "IN_PROGRESS",
        toStatus: "RESOLVED",
        message: "Cambié la fuente de poder",
      });
    });

    it("resolver sin nota falla sin cambiar nada", async () => {
      const id = await inProgress();
      const before = await snapshot(id);

      await expect(
        changeReportStatus(tech, id, { status: "RESOLVED", note: "" }),
      ).resolves.toEqual({
        ok: false,
        fieldErrors: { note: "Escribe qué se hizo para resolverlo." },
      });
      await expect(snapshot(id)).resolves.toEqual(before);
    });

    it("el admin puede iniciar y resolver cualquier reporte", async () => {
      const id = await assigned();

      await ok(changeReportStatus(admin, id, { status: "IN_PROGRESS" }));
      await ok(
        changeReportStatus(admin, id, { status: "RESOLVED", note: "Ok" }),
      );

      await expect(reportOf(id)).resolves.toMatchObject({ status: "RESOLVED" });
    });

    it.each<[string, () => Viewer]>([
      ["un técnico con reporte ajeno", () => otherTech],
      ["un administrativo", () => staff],
      ["un anónimo", () => null],
      ["el técnico asignado ya inactivo", () => ({ ...tech, isActive: false })],
    ])("%s no puede cambiarlo", async (_n, viewer) => {
      const id = await assigned();
      const before = await snapshot(id);

      await expect(
        changeReportStatus(viewer(), id, { status: "IN_PROGRESS" }),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(snapshot(id)).resolves.toEqual(before);
    });

    it("un técnico no puede tomar un reporte sin asignar", async () => {
      const id = await reported();

      await expect(
        changeReportStatus(tech, id, { status: "IN_PROGRESS" }),
      ).rejects.toBeInstanceOf(AuthorizationError);
    });

    it("no salta de reportado a en proceso", async () => {
      const id = await reported();

      await expect(
        changeReportStatus(admin, id, { status: "IN_PROGRESS" }),
      ).rejects.toBeInstanceOf(InvalidTransitionError);
    });

    it("no resuelve directo desde asignado", async () => {
      const id = await assigned();
      const before = await snapshot(id);

      await expect(
        changeReportStatus(tech, id, { status: "RESOLVED", note: "Listo" }),
      ).rejects.toBeInstanceOf(InvalidTransitionError);
      await expect(snapshot(id)).resolves.toEqual(before);
    });

    it("no reabre un reporte resuelto", async () => {
      const id = await inProgress();
      await ok(
        changeReportStatus(tech, id, { status: "RESOLVED", note: "Ok" }),
      );

      await expect(
        changeReportStatus(admin, id, { status: "IN_PROGRESS" }),
      ).rejects.toBeInstanceOf(InvalidTransitionError);
    });

    it("no acepta rechazar por esta vía", async () => {
      const id = await assigned();

      await expect(
        changeReportStatus(admin, id, { status: "REJECTED" }),
      ).resolves.toMatchObject({
        ok: false,
        fieldErrors: { status: expect.any(String) },
      });
    });

    it("informa un reporte inexistente", async () => {
      await expect(
        changeReportStatus(admin, "no-existe", { status: "IN_PROGRESS" }),
      ).rejects.toBeInstanceOf(ReportNotFoundError);
    });
  });

  describe("rejectReport", () => {
    it.each(["REPORTED", "ASSIGNED", "IN_PROGRESS"] as const)(
      "el admin rechaza un reporte %s con motivo",
      async (status) => {
        const id =
          status === "REPORTED"
            ? await reported()
            : status === "ASSIGNED"
              ? await assigned()
              : await inProgress();

        await ok(rejectReport(admin, id, { reason: "Falsa alarma" }));

        await expect(reportOf(id)).resolves.toMatchObject({
          status: "REJECTED",
          resolutionNote: "Falsa alarma",
          resolvedAt: null,
        });
        expect((await eventsOf(id)).at(-1)).toMatchObject({
          type: "STATUS_CHANGED",
          actorId: admin.id,
          fromStatus: status,
          toStatus: "REJECTED",
          message: "Falsa alarma",
        });
        await expect(assetStatus()).resolves.toBe("OPERATIONAL");
      },
    );

    it("exige el motivo", async () => {
      const id = await reported();

      await expect(rejectReport(admin, id, { reason: " " })).resolves.toEqual({
        ok: false,
        fieldErrors: { reason: "Escribe el motivo del rechazo." },
      });
      await expect(reportOf(id)).resolves.toMatchObject({ status: "REPORTED" });
    });

    it.each<[string, () => Viewer]>([
      ["el técnico asignado", () => tech],
      ["un administrativo", () => staff],
      ["un anónimo", () => null],
    ])("%s no puede rechazar", async (_n, viewer) => {
      const id = await assigned();
      const before = await snapshot(id);

      await expect(
        rejectReport(viewer(), id, { reason: "No aplica" }),
      ).rejects.toBeInstanceOf(AuthorizationError);
      await expect(snapshot(id)).resolves.toEqual(before);
    });

    it("no rechaza un reporte resuelto", async () => {
      const id = await inProgress();
      await ok(
        changeReportStatus(tech, id, { status: "RESOLVED", note: "Ok" }),
      );

      await expect(
        rejectReport(admin, id, { reason: "Tarde" }),
      ).rejects.toBeInstanceOf(InvalidTransitionError);
    });
  });

  describe("estado derivado del activo", () => {
    it("sin reportes está funcionando", async () => {
      await expect(assetStatus()).resolves.toBe("OPERATIONAL");
    });

    it("sigue el ciclo de un reporte", async () => {
      const id = await reported();
      await expect(assetStatus()).resolves.toBe("FAULT_REPORTED");

      await ok(assignReport(admin, id, { technicianId: tech.id }));
      await expect(assetStatus()).resolves.toBe("FAULT_REPORTED");

      await ok(changeReportStatus(tech, id, { status: "IN_PROGRESS" }));
      await expect(assetStatus()).resolves.toBe("IN_MAINTENANCE");

      await ok(
        changeReportStatus(tech, id, { status: "RESOLVED", note: "Ok" }),
      );
      await expect(assetStatus()).resolves.toBe("OPERATIONAL");
    });

    it("con dos reportes, en proceso gana a reportado", async () => {
      const working = await inProgress();
      await reported("Otra falla");

      await expect(assetStatus()).resolves.toBe("IN_MAINTENANCE");

      await ok(
        changeReportStatus(tech, working, { status: "RESOLVED", note: "Ok" }),
      );
      await expect(assetStatus()).resolves.toBe("FAULT_REPORTED");
    });

    it("un reporte nuevo no saca al activo de mantenimiento", async () => {
      await inProgress();
      await reported("Segunda falla");

      await expect(assetStatus()).resolves.toBe("IN_MAINTENANCE");
    });

    it("rechazar el único abierto lo deja funcionando", async () => {
      const id = await reported();

      await ok(rejectReport(admin, id, { reason: "Duplicado" }));

      await expect(assetStatus()).resolves.toBe("OPERATIONAL");
    });

    it("rechazar uno con otro abierto mantiene la falla", async () => {
      const first = await reported();
      await reported("Otra");

      await ok(rejectReport(admin, first, { reason: "Duplicado" }));

      await expect(assetStatus()).resolves.toBe("FAULT_REPORTED");
    });

    it("no toca otros activos", async () => {
      const other = await newAsset();

      await inProgress();

      await expect(assetStatus(other.id)).resolves.toBe("OPERATIONAL");
    });
  });

  describe("bitácora", () => {
    it("el ciclo completo deja los eventos correctos y en orden", async () => {
      const id = await reported("Falla", null);
      await ok(assignReport(admin, id, { technicianId: tech.id }));
      await ok(assignReport(admin, id, { technicianId: otherTech.id }));
      await ok(changeReportStatus(otherTech, id, { status: "IN_PROGRESS" }));
      await ok(
        changeReportStatus(otherTech, id, { status: "RESOLVED", note: "Ok" }),
      );

      const events = await eventsOf(id);

      expect(
        events.map(({ type, actorId, assigneeId, fromStatus, toStatus }) => ({
          type,
          actorId,
          assigneeId,
          fromStatus,
          toStatus,
        })),
      ).toEqual([
        {
          type: "CREATED",
          actorId: null,
          assigneeId: null,
          fromStatus: null,
          toStatus: "REPORTED",
        },
        {
          type: "ASSIGNED",
          actorId: admin.id,
          assigneeId: tech.id,
          fromStatus: "REPORTED",
          toStatus: "ASSIGNED",
        },
        {
          type: "ASSIGNED",
          actorId: admin.id,
          assigneeId: otherTech.id,
          fromStatus: "ASSIGNED",
          toStatus: "ASSIGNED",
        },
        {
          type: "STATUS_CHANGED",
          actorId: otherTech.id,
          assigneeId: null,
          fromStatus: "ASSIGNED",
          toStatus: "IN_PROGRESS",
        },
        {
          type: "STATUS_CHANGED",
          actorId: otherTech.id,
          assigneeId: null,
          fromStatus: "IN_PROGRESS",
          toStatus: "RESOLVED",
        },
      ]);
    });

    it("una acción rechazada no deja evento", async () => {
      const id = await assigned();

      await expect(
        changeReportStatus(otherTech, id, { status: "IN_PROGRESS" }),
      ).rejects.toThrow();

      await expect(eventsOf(id)).resolves.toHaveLength(2);
    });
  });

  describe("atomicidad", () => {
    // Un actor que no existe hace fallar la llave foránea del evento,
    // que es el último paso de la transacción.
    it("si falla el evento al crear, no queda reporte ni cambia el activo", async () => {
      await expect(
        createReport(ghostAdmin, asset.publicCode, { description: "Falla" }),
      ).rejects.toThrow();

      await expect(db.report.count()).resolves.toBe(0);
      await expect(assetStatus()).resolves.toBe("OPERATIONAL");
    });

    it("si falla el evento al asignar, nada cambia", async () => {
      const id = await reported();
      const before = await snapshot(id);

      await expect(
        assignReport(ghostAdmin, id, { technicianId: tech.id }),
      ).rejects.toThrow();

      await expect(snapshot(id)).resolves.toEqual(before);
    });

    it("si falla el evento al iniciar, el reporte y el activo no cambian", async () => {
      const id = await assigned();
      const before = await snapshot(id);

      await expect(
        changeReportStatus(ghostAdmin, id, { status: "IN_PROGRESS" }),
      ).rejects.toThrow();

      await expect(snapshot(id)).resolves.toEqual(before);
      expect(before.asset).toBe("FAULT_REPORTED");
    });

    it("si falla el evento al rechazar, nada cambia", async () => {
      const id = await inProgress();
      const before = await snapshot(id);

      await expect(
        rejectReport(ghostAdmin, id, { reason: "Duplicado" }),
      ).rejects.toThrow();

      await expect(snapshot(id)).resolves.toEqual(before);
      expect(before.asset).toBe("IN_MAINTENANCE");
    });

    it("si otro cambia el reporte entre la lectura y la escritura, lanza conflicto", async () => {
      const id = await assigned();
      let pending!: Promise<unknown>;

      // La transacción externa bloquea la fila: el servicio lee el estado viejo
      // y su escritura espera hasta que la externa confirma el rechazo.
      await db.$transaction(async (tx) => {
        await tx.report.update({ where: { id }, data: { status: "REJECTED" } });
        pending = changeReportStatus(tech, id, { status: "IN_PROGRESS" });
        pending.catch(() => {});
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      await expect(pending).rejects.toBeInstanceOf(ReportConflictError);
      await expect(eventsOf(id)).resolves.toHaveLength(2);
      await expect(assetStatus()).resolves.toBe("FAULT_REPORTED");
    });

    it("dos cambios simultáneos al mismo reporte: solo uno gana", async () => {
      const id = await assigned();

      const results = await Promise.allSettled([
        changeReportStatus(tech, id, { status: "IN_PROGRESS" }),
        rejectReport(admin, id, { reason: "Duplicado" }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ReportDomainError,
      );
      await expect(eventsOf(id)).resolves.toHaveLength(3);

      const { status } = await reportOf(id);
      await expect(assetStatus()).resolves.toBe(
        status === "IN_PROGRESS" ? "IN_MAINTENANCE" : "OPERATIONAL",
      );
    });
  });

  describe("errores tipados", () => {
    it("todos los errores de dominio comparten clase base y mensaje en español", () => {
      for (const error of [
        new ReportNotFoundError(),
        new AssetNotFoundError(),
        new InvalidTransitionError("RESOLVED", "start"),
        new InvalidAssigneeError(),
        new ReportConflictError(),
      ]) {
        expect(error).toBeInstanceOf(ReportDomainError);
        expect(error.message).toMatch(/[a-záéíóúñ]/);
      }
    });

    it("la transición inválida dice desde qué estado", () => {
      expect(new InvalidTransitionError("RESOLVED", "start").message).toBe(
        "No se puede iniciar un reporte en estado «Resuelto».",
      );
    });
  });
});
