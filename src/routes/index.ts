import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env, Variables } from "../types";
import { todosRouter } from "./v1/todos/index";

const app = new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();

app.route("/api/v1/todos", todosRouter);

export const router = app;
