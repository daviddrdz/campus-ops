import "dotenv/config";
import { db } from "../src/server/db";
import { seedDatabase } from "./seed-data";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed de desarrollo no se ejecuta en producción.");
  }

  const userPassword = process.env.SEED_USER_PASSWORD;

  if (!userPassword) {
    throw new Error("Falta SEED_USER_PASSWORD. Revisa .env.example.");
  }

  await seedDatabase(db, { userPassword });
  console.log("Seed aplicado.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
