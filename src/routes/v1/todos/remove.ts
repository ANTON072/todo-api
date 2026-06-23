import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { createDb } from "../../../db/index";
import { todos } from "../../../db/schema/todos";
import { ForbiddenError, NotFoundError } from "../../../lib/errors";
import { createHono } from "../../../lib/hono";

const paramsSchema = z.object({ todoId: z.string() });

const route = createRoute({
  method: "delete",
  path: "/{todoId}",
  security: [{ bearerAuth: [] }],
  tags: ["todos"],
  request: { params: paramsSchema },
  responses: {
    204: { description: "No Content" },
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

  await db.delete(todos).where(eq(todos.id, todoId));

  return c.body(null, 204);
});

export const removeTodoRoute = app;
