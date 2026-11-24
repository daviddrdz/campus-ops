import type {
  ReportEventType,
  ReportPriority,
  ReportStatus,
} from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/dates";
import {
  reportEventTypeLabels,
  reportPriorityLabels,
  reportStatusLabels,
} from "@/lib/labels";

export type TimelineEvent = {
  id: string;
  type: ReportEventType;
  createdAt: Date;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus | null;
  message: string | null;
  priority: ReportPriority | null;
  actor: { name: string } | null;
  assignee: { name: string } | null;
};

function titleOf(event: TimelineEvent) {
  switch (event.type) {
    case "ASSIGNED": {
      const name = event.assignee?.name ?? "un técnico";

      return event.fromStatus === "REPORTED"
        ? `Asignado a ${name}`
        : `Reasignado a ${name}`;
    }
    case "STATUS_CHANGED":
      return event.toStatus
        ? reportStatusLabels[event.toStatus]
        : reportEventTypeLabels.STATUS_CHANGED;
    case "PRIORITY_CHANGED":
      return event.priority
        ? `Prioridad ${reportPriorityLabels[event.priority].toLowerCase()}`
        : reportEventTypeLabels.PRIORITY_CHANGED;
    default:
      return reportEventTypeLabels[event.type];
  }
}

function actorOf(event: TimelineEvent) {
  if (event.actor) return event.actor.name;

  return event.type === "CREATED" ? "Persona sin cuenta" : "Sistema";
}

export function ReportTimeline({ events }: { events: TimelineEvent[] }) {
  // El servidor ya los manda en orden; se reordena por si acaso, sin mutar la lista.
  const ordered = events.toSorted(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return (
    <ol className="relative space-y-5 border-l-2 border-border pl-5">
      {ordered.map((event) => (
        <li key={event.id} className="relative">
          <span
            aria-hidden
            className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-background bg-[var(--plate-rivet)]"
          />
          <p className="font-medium">{titleOf(event)}</p>
          <p className="text-sm text-muted-foreground">
            {actorOf(event)},{" "}
            <time dateTime={event.createdAt.toISOString()}>
              {formatDateTime(event.createdAt)}
            </time>
          </p>
          {event.message ? (
            <p className="mt-1.5 border-l-2 border-signal pl-3 text-sm wrap-anywhere whitespace-pre-line">
              {event.message}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
