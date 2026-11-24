import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { ACCOUNT_INACTIVE_CODE } from "@/lib/auth-errors";
import { db } from "@/server/db";

const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

export const auth = betterAuth({
  appName: "CampusOps",
  baseURL: process.env.APP_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: ["ADMIN", "TECHNICIAN", "STAFF"],
        required: false,
        input: false,
      },
      isActive: {
        type: "boolean",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: SEVEN_DAYS_IN_SECONDS,
    updateAge: ONE_DAY_IN_SECONDS,
  },
  rateLimit: {
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });

          if (!user?.isActive) {
            throw new APIError("FORBIDDEN", {
              code: ACCOUNT_INACTIVE_CODE,
              message: "La cuenta está desactivada.",
            });
          }
        },
      },
    },
  },
  // Debe ser el último plugin.
  plugins: [nextCookies()],
});
