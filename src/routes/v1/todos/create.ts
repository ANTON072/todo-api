import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { createDb } from "../../../db/index";
import { todos } from "../../../db/schema/todos";
import { createHono } from "../../../lib/hono";

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  dueDate: z.number().int().optional(),
});

const todoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(["todo", "in_progress", "done"]),
  dueDate: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const route = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: { "application/json": { schema: bodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: todoSchema } },
      description: "Created todo",
    },
  },
});

const app = createHono();

app.openapi(route, async (c) => {
  const body = c.req.valid("json");
  const user = c.get("user");
  const db = createDb(c.env);

  const id = crypto.randomUUID();
  await db.insert(todos).values({
    id,
    userId: user.id,
    title: body.title,
    description: body.description ?? null,
    status: body.status ?? "todo",
    dueDate: body.dueDate ?? null,
  });

  const [todo] = await db.select().from(todos).where(eq(todos.id, id));

  // biome-ignore lint/style/noNonNullAssertion: row was just inserted
  return c.json(todo!, 201);
});

export const createTodoRoute = app;
