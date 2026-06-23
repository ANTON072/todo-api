import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { createDb } from "../../../db/index";
import { todos } from "../../../db/schema/todos";
import { ForbiddenError, NotFoundError } from "../../../lib/errors";
import { createHono } from "../../../lib/hono";

const paramsSchema = z.object({ todoId: z.string() });

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
  method: "get",
  path: "/{todoId}",
  security: [{ bearerAuth: [] }],
  tags: ["todos"],
  request: { params: paramsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: todoSchema } },
      description: "Todo detail",
    },
  },
});

const app = createHono();

app.openapi(route, async (c) => {
  const { todoId } = c.req.valid("param");
  const user = c.get("user");
  const db = createDb(c.env);

  const [todo] = await db.select().from(todos).where(eq(todos.id, todoId));

  if (!todo) throw new NotFoundError(`Todo '${todoId}' was not found`);
  if (todo.userId !== user.id) throw new ForbiddenError();

  return c.json(todo);
});

export const detailTodoRoute = app;
