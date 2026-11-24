import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ReportTimeline,
  type TimelineEvent,
} from "@/components/reports/report-timeline";

const base = {
  fromStatus: null,
  toStatus: null,
  message: null,
  priority: null,
  actor: null,
  assignee: null,
} satisfies Partial<TimelineEvent>;

const admin = { name: "Ana Admin" };

const events: TimelineEvent[] = [
  {
    ...base,
    id: "e3",
    type: "PRIORITY_CHANGED",
    createdAt: new Date("2026-11-24T16:10:00Z"),
    fromStatus: "ASSIGNED",
    toStatus: "ASSIGNED",
    priority: "HIGH",
    actor: admin,
  },
  {
    ...base,
    id: "e1",
    type: "CREATED",
    createdAt: new Date("2026-11-24T16:00:00Z"),
    toStatus: "REPORTED",
  },
  {
    ...base,
    id: "e5",
    type: "STATUS_CHANGED",
    createdAt: new Date("2026-11-24T16:30:00Z"),
    fromStatus: "ASSIGNED",
    toStatus: "REJECTED",
    message: "Duplicado del folio 4",
    actor: admin,
  },
  {
    ...base,
    id: "e2",
    type: "ASSIGNED",
    createdAt: new Date("2026-11-24T16:05:00Z"),
    fromStatus: "REPORTED",
    toStatus: "ASSIGNED",
    actor: admin,
    assignee: { name: "Tomás Técnico" },
  },
  {
    ...base,
    id: "e4",
    type: "ASSIGNED",
    createdAt: new Date("2026-11-24T16:20:00Z"),
    fromStatus: "ASSIGNED",
    toStatus: "ASSIGNED",
    actor: admin,
    assignee: { name: "Rita Técnica" },
  },
];

describe("ReportTimeline", () => {
  it("muestra los eventos en orden cronológico", () => {
    render(<ReportTimeline events={events} />);

    const titles = screen
      .getAllByRole("listitem")
      .map((item) => item.querySelector("p")?.textContent);

    expect(titles).toEqual([
      "Reporte creado",
      "Asignado a Tomás Técnico",
      "Prioridad alta",
      "Reasignado a Rita Técnica",
      "Rechazado",
    ]);
  });

  it("dice quién hizo cada cambio y muestra el motivo", () => {
    render(<ReportTimeline events={events} />);
    const [created, , , , rejected] = screen.getAllByRole("listitem");

    expect(within(created).getByText(/Persona sin cuenta/)).toBeInTheDocument();
    expect(within(rejected).getByText(/Ana Admin/)).toBeInTheDocument();
    expect(
      within(rejected).getByText("Duplicado del folio 4"),
    ).toBeInTheDocument();
  });

  it("no reordena la lista que recibe", () => {
    const ids = events.map((e) => e.id);
    render(<ReportTimeline events={events} />);

    expect(events.map((e) => e.id)).toEqual(ids);
  });
});
