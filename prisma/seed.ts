import "dotenv/config";
import { db } from "../src/server/db";
import { seedDatabase } from "./seed-data";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed de desarrollo no se ejecuta en producción.");
  }

  await seedDatabase(db);
  console.log("Seed aplicado.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
