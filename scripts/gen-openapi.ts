import { writeFileSync } from "node:fs";
import { OpenAPIHono } from "@hono/zod-openapi";
import { todosRouter } from "../src/routes/v1/todos/index";
import type { Env, Variables } from "../src/types";

const app = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

app.route("/api/v1/todos", todosRouter);

const spec = app.getOpenAPIDocument({
  openapi: "3.0.0",
  info: {
    title: "Todo API",
    version: "1.0.0",
    description: "Cloudflare Workers + D1 Todo REST API",
  },
});

writeFileSync("openapi.json", JSON.stringify(spec, null, 2));
console.log("openapi.json generated");
