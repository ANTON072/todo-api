import { createAuth } from "./lib/auth";
import { createHono } from "./lib/hono";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";
import { router } from "./routes/index";

const app = createHono();

app.use("*", corsMiddleware());
app.onError(errorHandler);

// Mount better-auth handler at /api/auth/*
app.on(["GET", "POST", "PUT", "DELETE", "PATCH"], "/api/auth/*", (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

app.route("/", router);

export default app;
