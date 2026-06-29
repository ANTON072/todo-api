import { serve } from "@hono/node-server";
import app from "./index";
import type { Env } from "./types";

const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET as string,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  APP_URL: process.env.APP_URL as string,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION,
};

serve({
  fetch: (req) => app.fetch(req, env),
  port: Number(process.env.PORT ?? 3000),
});
