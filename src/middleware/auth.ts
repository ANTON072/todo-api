import { createMiddleware } from "hono/factory";
import { createAuth } from "../lib/auth";
import { UnauthorizedError } from "../lib/errors";
import type { Env, Variables } from "../types";

export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    throw new UnauthorizedError("Authentication required");
  }

  c.set("user", session.user);
  await next();
});
