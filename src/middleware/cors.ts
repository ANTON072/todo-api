import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../types";

export function corsMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const origins = c.env.ALLOWED_ORIGINS
      ? c.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : ["*"];

    return cors({
      origin: origins.length === 1 && origins[0] === "*" ? "*" : origins,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })(c, next);
  };
}
