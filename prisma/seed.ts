import "dotenv/config";
import { resolveSeedPassword } from "../scripts/deploy-env";
import { db } from "../src/server/db";
import { seedDatabase } from "./seed-data";

async function main() {
  const userPassword = resolveSeedPassword(process.env);

  await seedDatabase(db, { userPassword });
  console.log("Seed aplicado.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
