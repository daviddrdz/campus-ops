import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { generatePublicCode } from "@/lib/public-code";
import { AuthorizationError } from "@/server/auth/guards";
import type { Viewer } from "@/server/auth/permissions";
import { db } from "@/server/db";
import {
  InvalidAssigneeError,
  InvalidTransitionError,
  UnchangedPriorityError,
} from "@/server/reports/errors";
import {
  getReportDetail,
  listReports,
  listTechnicians,
  REPORTS_PAGE_SIZE,
} from "@/server/reports/queries";
import {
  assignReport,
  changeReportStatus,
  createReport,
  rejectReport,
  setReportPriority,
} from "@/server/reports/service";
import { resetDb } from "./reset-db";

type Actor = NonNullable<Viewer>;

let sequence = 0;

async function newUser(role: UserRole, isActive = true): Promise<Actor> {
  const n = ++sequence;
  const user = await db.user.create({
    data: { name: `${role} ${n}`, email: `u${n}@test.mx`, role, isActive },
  });

  return { id: user.id, role: user.role, isActive: user.isActive };
}

async function newAsset(name: string, room = `Aula ${++sequence}`) {
  const location = await db.location.create({
    data: { building: "Edificio B", room },
  });

  return db.asset.create({
    data: {
      publicCode: generatePublicCode(),
      inventoryNumber: `INV-${++sequence}`,
      name,
      type: "COMPUTER",
      locationId: location.id,
    },
  });
}

async function report(publicCode: string, description = "No enciende") {
  const result = await createReport(null, publicCode, { description });

  if (!result.ok) throw new Error("No se pudo crear el reporte de prueba.");

  return result.data.id;
}

async function ok(promise: Promise<{ ok: boolean }>) {
  const result = await promise;

  if (!result.ok) throw new Error(`Falló: ${JSON.stringify(result)}`);
}

const folios = (inbox: Awaited<ReturnType<typeof listReports>>) =>
  inbox.reports.map((r) => r.folio);

let admin: Actor;
let staff: Actor;
let tech: Actor;
let otherTech: Actor;
let projector: Awaited<ReturnType<typeof newAsset>>;
let computer: Awaited<ReturnType<typeof newAsset>>;

describe("bandeja y detalle de reportes", () => {
  beforeEach(async () => {
    await resetDb();
    sequence = 0;
    [admin, staff, tech, otherTech] = await Promise.all([
      newUser("ADMIN"),
      newUser("STAFF"),
      newUser("TECHNICIAN"),
      newUser("TECHNICIAN"),
    ]);
    projector = await newAsset("Proyector Epson", "Sala de juntas");
    computer = await newAsset("PC Dell 7010", "Laboratorio 2");
  });
  afterAll(() => db.$disconnect());

  // Folios: 1 reportado, 2 asignado a tech, 3 en proceso (otherTech), 4 resuelto (tech), 5 rechazado.
  async function seedReports() {
    const reported = await report(projector.publicCode);
    const assigned = await report(computer.publicCode);
    await ok(assignReport(admin, assigned, { technicianId: tech.id }));
    const inProgress = await report(projector.publicCode);
    await ok(assignReport(admin, inProgress, { technicianId: otherTech.id }));
    await ok(
      changeReportStatus(otherTech, inProgress, { status: "IN_PROGRESS" }),
    );
    const resolved = await report(computer.publicCode);
    await ok(assignReport(admin, resolved, { technicianId: tech.id }));
    await ok(changeReportStatus(tech, resolved, { status: "IN_PROGRESS" }));
    await ok(
      changeReportStatus(tech, resolved, {
        status: "RESOLVED",
        note: "Cambio de fuente",
      }),
    );
    const rejected = await report(computer.publicCode);
    await ok(rejectReport(admin, rejected, { reason: "Duplicado" }));

    return { reported, assigned, inProgress, resolved, rejected };
  }

  describe("listReports: alcance por rol", () => {
    it("ADMIN y STAFF ven todos los reportes", async () => {
      await seedReports();

      for (const viewer of [admin, staff]) {
        const inbox = await listReports(viewer, { estado: "todos" });

        expect(inbox.scope).toBe("all");
        expect(folios(inbox)).toEqual([5, 4, 3, 2, 1]);
      }
    });

    it("TECHNICIAN solo ve los suyos, aunque pida los de otro técnico", async () => {
      await seedReports();

      const own = await listReports(tech, { estado: "todos" });
      expect(own.scope).toBe("assigned");
      expect(folios(own)).toEqual([4, 2]);

      const spoofed = await listReports(tech, {
        estado: "todos",
        tecnico: otherTech.id,
      });
      expect(folios(spoofed)).toEqual([4, 2]);

      const unassigned = await listReports(tech, {
        estado: "todos",
        tecnico: "sin-asignar",
      });
      expect(folios(unassigned)).toEqual([4, 2]);
    });

    it("un anónimo o un usuario inactivo no entra a la bandeja", async () => {
      const inactive = await newUser("ADMIN", false);

      await expect(listReports(null)).rejects.toThrow(AuthorizationError);
      await expect(listReports(inactive)).rejects.toThrow(AuthorizationError);
    });

    it("no expone el hash de IP de quien reportó", async () => {
      await createReport(
        null,
        projector.publicCode,
        { description: "Sin imagen" },
        { reporterIpHash: "hash-secreto" },
      );

      const inbox = await listReports(admin);
      const [first] = inbox.reports;
      const detail = await getReportDetail(admin, first.id);

      expect(JSON.stringify(inbox)).not.toContain("hash-secreto");
      expect(JSON.stringify(detail)).not.toContain("hash-secreto");
    });
  });

  describe("listReports: filtros", () => {
    it("por defecto muestra solo los abiertos, recientes primero", async () => {
      await seedReports();

      expect(folios(await listReports(admin))).toEqual([3, 2, 1]);
      expect(folios(await listReports(admin, {}))).toEqual([3, 2, 1]);
    });

    it("filtra por un estado concreto", async () => {
      await seedReports();

      expect(folios(await listReports(admin, { estado: "RESOLVED" }))).toEqual([
        4,
      ]);
      expect(folios(await listReports(admin, { estado: "REJECTED" }))).toEqual([
        5,
      ]);
      expect(folios(await listReports(admin, { estado: "REPORTED" }))).toEqual([
        1,
      ]);
    });

    it("un estado inválido vuelve a «abiertos» sin romper", async () => {
      await seedReports();

      const inbox = await listReports(admin, { estado: "BORRADO" });

      expect(inbox.filters.status).toBe("open");
      expect(folios(inbox)).toEqual([3, 2, 1]);
    });

    it("filtra por activo con texto: nombre, inventario o ubicación", async () => {
      await seedReports();

      expect(
        folios(await listReports(admin, { estado: "todos", q: "epson" })),
      ).toEqual([3, 1]);
      expect(
        folios(
          await listReports(admin, { estado: "todos", q: "laboratorio dell" }),
        ),
      ).toEqual([5, 4, 2]);
      expect(
        folios(
          await listReports(admin, {
            estado: "todos",
            q: computer.inventoryNumber,
          }),
        ),
      ).toEqual([5, 4, 2]);
      expect(
        folios(await listReports(admin, { estado: "todos", q: "%" })),
      ).toEqual([]);
    });

    it("filtra por técnico y por «sin asignar»", async () => {
      await seedReports();

      expect(
        folios(await listReports(admin, { estado: "todos", tecnico: tech.id })),
      ).toEqual([4, 2]);
      expect(
        folios(
          await listReports(staff, {
            estado: "todos",
            tecnico: "sin-asignar",
          }),
        ),
      ).toEqual([5, 1]);
    });

    it("combina filtros", async () => {
      await seedReports();

      expect(
        folios(
          await listReports(admin, {
            estado: "ASSIGNED",
            q: "dell",
            tecnico: tech.id,
          }),
        ),
      ).toEqual([2]);
    });

    it("pagina de 20 en 20 y ajusta una página fuera de rango", async () => {
      for (let i = 0; i < REPORTS_PAGE_SIZE + 3; i++) {
        await db.report.create({
          data: { assetId: projector.id, description: `Falla ${i}` },
        });
      }

      const first = await listReports(admin);
      expect(first.total).toBe(23);
      expect(first.pageCount).toBe(2);
      expect(first.reports).toHaveLength(20);
      expect(first.reports[0].folio).toBe(23);

      const second = await listReports(admin, { pagina: "2" });
      expect(folios(second)).toEqual([3, 2, 1]);

      const beyond = await listReports(admin, { pagina: "99" });
      expect(beyond.page).toBe(2);
      expect(folios(beyond)).toEqual([3, 2, 1]);

      const garbage = await listReports(admin, { pagina: "-4" });
      expect(garbage.page).toBe(1);
    });

    it("sin resultados queda en la página 1 de 1", async () => {
      const inbox = await listReports(admin);

      expect(inbox).toMatchObject({ total: 0, page: 1, pageCount: 1 });
      expect(inbox.reports).toEqual([]);
    });
  });

  describe("getReportDetail", () => {
    it("trae la bitácora en orden con actores y técnico asignado", async () => {
      const { assigned } = await seedReports();
      await ok(setReportPriority(admin, assigned, { priority: "HIGH" }));
      await ok(assignReport(admin, assigned, { technicianId: otherTech.id }));

      const detail = await getReportDetail(admin, assigned);

      expect(detail?.events.map((e) => e.type)).toEqual([
        "CREATED",
        "ASSIGNED",
        "PRIORITY_CHANGED",
        "ASSIGNED",
      ]);
      expect(detail?.events[0].actor).toBeNull();
      expect(detail?.events[1].assignee?.name).toBe("TECHNICIAN 3");
      expect(detail?.events[2]).toMatchObject({
        priority: "HIGH",
        actor: { name: "ADMIN 1" },
      });
      expect(detail?.events[3].assignee?.name).toBe("TECHNICIAN 4");
      expect(detail?.assignedTo?.name).toBe("TECHNICIAN 4");
    });

    it("da las operaciones que el usuario puede hacer", async () => {
      const { reported, inProgress, resolved } = await seedReports();

      expect((await getReportDetail(admin, reported))?.operations).toEqual([
        "assign",
        "reject",
        "prioritize",
        "comment",
      ]);
      expect(
        (await getReportDetail(otherTech, inProgress))?.operations,
      ).toEqual(["resolve", "comment"]);
      expect((await getReportDetail(staff, reported))?.operations).toEqual([]);
      expect((await getReportDetail(admin, resolved))?.operations).toEqual([]);
    });

    it("el técnico ve los suyos; uno ajeno o inexistente es null", async () => {
      const { assigned, inProgress, reported } = await seedReports();

      expect((await getReportDetail(tech, assigned))?.folio).toBe(2);
      expect(await getReportDetail(tech, inProgress)).toBeNull();
      expect(await getReportDetail(tech, reported)).toBeNull();
      expect(await getReportDetail(admin, "no-existe")).toBeNull();
      expect(await getReportDetail(admin, "x".repeat(500))).toBeNull();
    });

    it("STAFF ve el detalle en solo lectura, con el contacto de quien reportó", async () => {
      const result = await createReport(null, projector.publicCode, {
        description: "Ruido",
        reporterName: "Luis",
        reporterEmail: "luis@escuela.mx",
      });
      if (!result.ok) throw new Error("No se creó el reporte.");

      const detail = await getReportDetail(staff, result.data.id);

      expect(detail).toMatchObject({
        reporterName: "Luis",
        reporterEmail: "luis@escuela.mx",
        operations: [],
      });
    });
  });

  describe("listTechnicians", () => {
    it("lista técnicos, activos primero, sin otros roles", async () => {
      await newUser("TECHNICIAN", false);

      const technicians = await listTechnicians(admin);

      expect(technicians.map((t) => [t.name, t.isActive])).toEqual([
        ["TECHNICIAN 3", true],
        ["TECHNICIAN 4", true],
        ["TECHNICIAN 7", false],
      ]);
    });
  });

  describe("asignación", () => {
    it("asignar a alguien que no es técnico se rechaza", async () => {
      const id = await report(projector.publicCode);

      for (const notTechnician of [admin, staff]) {
        await expect(
          assignReport(admin, id, { technicianId: notTechnician.id }),
        ).rejects.toThrow(InvalidAssigneeError);
      }
    });

    it("STAFF no puede asignar, priorizar ni rechazar", async () => {
      const id = await report(projector.publicCode);

      await expect(
        assignReport(staff, id, { technicianId: tech.id }),
      ).rejects.toThrow(AuthorizationError);
      await expect(
        setReportPriority(staff, id, { priority: "HIGH" }),
      ).rejects.toThrow(AuthorizationError);
      await expect(rejectReport(staff, id, { reason: "No" })).rejects.toThrow(
        AuthorizationError,
      );
    });
  });

  describe("setReportPriority", () => {
    it("cambia la prioridad, deja el evento y no mueve el estado", async () => {
      const id = await report(projector.publicCode);

      const result = await setReportPriority(admin, id, { priority: "LOW" });

      expect(result).toMatchObject({
        ok: true,
        data: { status: "REPORTED", assetStatus: "FAULT_REPORTED" },
      });
      expect(
        await db.report.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({ priority: "LOW", status: "REPORTED" });

      const events = await db.reportEvent.findMany({
        where: { reportId: id },
        orderBy: { createdAt: "asc" },
      });
      expect(events.at(-1)).toMatchObject({
        type: "PRIORITY_CHANGED",
        priority: "LOW",
        actorId: admin.id,
        fromStatus: "REPORTED",
        toStatus: "REPORTED",
      });
    });

    it("la misma prioridad se rechaza sin crear evento", async () => {
      const id = await report(projector.publicCode);

      await expect(
        setReportPriority(admin, id, { priority: "MEDIUM" }),
      ).rejects.toThrow(UnchangedPriorityError);
      expect(await db.reportEvent.count({ where: { reportId: id } })).toBe(1);
    });

    it("una prioridad inválida vuelve como error de campo", async () => {
      const id = await report(projector.publicCode);

      expect(
        await setReportPriority(admin, id, { priority: "URGENTE" }),
      ).toEqual({
        ok: false,
        fieldErrors: { priority: "Elige una prioridad." },
      });
    });

    it("no se cambia en reportes cerrados", async () => {
      const { resolved, rejected } = await seedReports();

      for (const id of [resolved, rejected]) {
        await expect(
          setReportPriority(admin, id, { priority: "HIGH" }),
        ).rejects.toThrow(InvalidTransitionError);
      }
    });

    it("el técnico no la cambia, ni en su propio reporte", async () => {
      const { assigned } = await seedReports();

      await expect(
        setReportPriority(tech, assigned, { priority: "HIGH" }),
      ).rejects.toThrow(AuthorizationError);
    });
  });
});
