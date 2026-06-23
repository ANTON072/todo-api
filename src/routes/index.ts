import { swaggerUI } from "@hono/swagger-ui";
import { createHono } from "../lib/hono";
import { todosRouter } from "./v1/todos/index";

const app = createHono();

app.route("/api/v1/todos", todosRouter);

app.doc("/api/docs/openapi.json", {
  openapi: "3.0.0",
  info: { title: "TODO API", version: "1.0.0" },
});

app.get("/api/docs", swaggerUI({ url: "/api/docs/openapi.json" }));

export const router = app;
