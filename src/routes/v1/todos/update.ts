import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { createDb } from "../../../db/index";
import { todos } from "../../../db/schema/todos";
import { ForbiddenError, NotFoundError } from "../../../lib/errors";
import { createHono } from "../../../lib/hono";

const paramsSchema = z.object({ todoId: z.string() });

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  status: z.enum(["todo", "in_progress", "done"]),
  dueDate: z.number().int().nullable(),
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
  method: "put",
  path: "/{todoId}",
  request: {
    params: paramsSchema,
    body: {
      content: { "application/json": { schema: bodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: todoSchema } },
      description: "Updated todo",
    },
  },
});

const app = createHono();

app.openapi(route, async (c) => {
  const { todoId } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");
  const db = createDb(c.env);

  const [existing] = await db.select().from(todos).where(eq(todos.id, todoId));

  if (!existing) throw new NotFoundError(`Todo '${todoId}' was not found`);
  if (existing.userId !== user.id) throw new ForbiddenError();

  // updatedAt is auto-set by $onUpdateFn in the schema
  await db
    .update(todos)
    .set({
      title: body.title,
      description: body.description,
      status: body.status,
      dueDate: body.dueDate,
    })
    .where(eq(todos.id, todoId));

  const [updated] = await db.select().from(todos).where(eq(todos.id, todoId));

  // biome-ignore lint/style/noNonNullAssertion: row exists after update
  return c.json(updated!);
});

export const updateTodoRoute = app;
