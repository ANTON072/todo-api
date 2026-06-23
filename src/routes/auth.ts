import { createRoute, z } from "@hono/zod-openapi";
import { createHono } from "../lib/hono";

const authResponseSchema = z.object({
  token: z.string(),
  user: z.object({ id: z.string(), email: z.string(), name: z.string() }),
});

const signUpRoute = createRoute({
  method: "post",
  path: "/sign-up/email",
  tags: ["auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
            password: z.string().min(8),
            name: z.string().min(1),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: authResponseSchema } },
      description: "User created — copy the token and use it in Authorize",
    },
  },
});

const signInRoute = createRoute({
  method: "post",
  path: "/sign-in/email",
  tags: ["auth"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
            password: z.string(),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: authResponseSchema } },
      description: "Signed in — copy the token and use it in Authorize",
    },
    401: {
      description: "Invalid credentials",
    },
  },
});

const app = createHono();

// Stub handlers — better-auth intercepts /api/auth/* before these ever run.
// These routes exist only to populate the OpenAPI spec.
app.openapi(signUpRoute, (c) =>
  c.json({ token: "", user: { id: "", email: "", name: "" } }, 200),
);
app.openapi(signInRoute, (c) =>
  c.json({ token: "", user: { id: "", email: "", name: "" } }, 200),
);

export const authDocsRouter = app;
