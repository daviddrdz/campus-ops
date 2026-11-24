import { connection } from "next/server";

export async function GET() {
  // Sin esto, Cache Components prerenderiza la respuesta durante el build.
  await connection();

  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
