import { createRoute, z } from "@hono/zod-openapi";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { createDb } from "../../../db/index";
import { todos } from "../../../db/schema/todos";
import { createHono } from "../../../lib/hono";

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

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
});

const responseSchema = z.object({
  todos: z.array(todoSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

const route = createRoute({
  method: "get",
  path: "/",
  security: [{ bearerAuth: [] }],
  tags: ["todos"],
  request: { query: querySchema },
  responses: {
    200: {
      content: { "application/json": { schema: responseSchema } },
      description: "List of todos",
    },
  },
});

const app = createHono();

app.openapi(route, async (c) => {
  const { page, limit, status } = c.req.valid("query");
  const user = c.get("user");
  const db = createDb(c.env);

  const where = status
    ? and(eq(todos.userId, user.id), eq(todos.status, status))
    : eq(todos.userId, user.id);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(todos)
    .where(where);

  const items = await db
    .select()
    .from(todos)
    .where(where)
    .orderBy(desc(todos.createdAt), desc(sql<number>`rowid`))
    .limit(limit)
    .offset((page - 1) * limit);

  return c.json({
    todos: items.map((t) => ({ ...t, userId: t.userId })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

export const listTodosRoute = app;
