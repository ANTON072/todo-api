import { handle } from "hono/aws-lambda";
import app from "./index";
import type { Env } from "./types";

// Read process.env once at module load (Lambda container reuse keeps this value stable)
const env: Env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET as string,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  APP_URL: process.env.APP_URL as string,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION,
};

// Pass process.env bindings directly to app.fetch instead of Lambda's {event, lambdaContext}
export const handler = handle({
  fetch: (req: Request) => app.fetch(req, env),
} as unknown as typeof app);
