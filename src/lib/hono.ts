import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env, Variables } from "../types";

export function createHono() {
  return new OpenAPIHono<{ Bindings: Env; Variables: Variables }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            type: "about:blank",
            title: "Unprocessable Entity",
            status: 422,
            detail: "Request body validation failed",
            errors: result.error.issues.map((e) => ({
              path: e.path.map(String),
              message: e.message,
            })),
          },
          422,
          { "Content-Type": "application/problem+json" },
        );
      }
    },
  });
}
