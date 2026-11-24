// El servidor de despliegue corre en UTC: la hora se muestra siempre en la del campus.
const CAMPUS_TIME_ZONE = "America/Mexico_City";

const dateTimeFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: CAMPUS_TIME_ZONE,
});

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}
