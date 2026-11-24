import { getSession } from "@/server/auth/session";
import { listNotifications } from "@/server/notifications/service";

const noStore = { "Cache-Control": "no-store" };

// Lo consulta la campana cada 30 s. Solo devuelve los avisos de quien pregunta.
export async function GET() {
  const viewer = await getSession();

  if (!viewer) {
    return Response.json(
      { error: "Inicia sesión para ver tus avisos." },
      { status: 401, headers: noStore },
    );
  }

  return Response.json(await listNotifications(viewer), { headers: noStore });
}
