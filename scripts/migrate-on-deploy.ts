// Corre en el build de Vercel antes de `next build` (ver `vercel-build` en package.json).
import { execFileSync } from "node:child_process";
import { planDeployMigration } from "./deploy-env";

const packageManager = process.env.npm_config_user_agent?.split(" ")[0];
console.log(
  `Node ${process.version} · ${packageManager ?? "gestor desconocido"}`,
);

const plan = planDeployMigration(process.env);

if (plan.migrate) {
  // prisma7.config.ts toma DATABASE_URL_UNPOOLED para las migraciones.
  execFileSync("prisma", ["migrate", "deploy"], { stdio: "inherit" });
} else {
  console.log(plan.reason);
}
