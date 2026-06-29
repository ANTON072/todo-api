import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Resend } from "resend";
import * as authSchema from "../db/schema/auth";
import type { Env } from "../types";

export function createAuth(env: Env) {
  const db = drizzle(postgres(env.DATABASE_URL));
  const skipVerification = env.SKIP_EMAIL_VERIFICATION === "true";

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authSchema.user,
        session: authSchema.session,
        account: authSchema.account,
        verification: authSchema.verification,
      },
    }),
    plugins: [bearer()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: !skipVerification,
    },
    emailVerification: {
      // expiresIn: token TTL in seconds — 1 hour per requirements
      expiresIn: 3600,
      sendVerificationEmail: skipVerification
        ? async () => {}
        : async ({
            user: u,
            url,
          }: {
            user: { email: string };
            url: string;
            token: string;
          }) => {
            const resend = new Resend(env.RESEND_API_KEY);
            await resend.emails.send({
              from: "noreply@todo-api.workers.dev",
              to: u.email,
              subject: "Verify your email address",
              html: `<p>Click <a href="${url}">here</a> to verify your email address.</p>`,
            });
          },
    },
    user: {
      deleteUser: {
        enabled: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
