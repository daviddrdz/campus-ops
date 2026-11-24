import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadTestDatabaseUrl } from "../helpers/test-database.mts";

export default function setup() {
  const prisma = join(process.cwd(), "node_modules", ".bin", "prisma");

  execFileSync(prisma, ["migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: loadTestDatabaseUrl() },
    stdio: "pipe",
  });
}
