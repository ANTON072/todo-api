import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { account, session, user, verification } from "../src/db/schema/auth";
import { todos } from "../src/db/schema/todos";
import app from "../src/index";
import type { Env } from "../src/types";

const testEnv: Env = {
  DATABASE_URL: process.env.DATABASE_URL as string,
  BETTER_AUTH_SECRET: "test-secret-for-testing-only",
  RESEND_API_KEY: "test",
  APP_URL: "http://localhost",
  SKIP_EMAIL_VERIFICATION: "true",
};

const sql = postgres(testEnv.DATABASE_URL);
const db = drizzle(sql);

let authToken: string;

async function authedFetch(path: string, init?: RequestInit) {
  return app.request(
    path,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        ...(init?.headers as Record<string, string>),
      },
    },
    testEnv,
  );
}

beforeAll(async () => {
  await db.delete(todos);
  await db.delete(verification);
  await db.delete(session);
  await db.delete(account);
  await db.delete(user);

  const res = await app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "todo@example.com",
        password: "password123",
        name: "Todo User",
      }),
    },
    testEnv,
  );
  const body = await res.json<{ token: string }>();
  authToken = body.token;
});

beforeEach(async () => {
  await db.delete(todos);
});

afterAll(async () => {
  await sql.end();
});

describe("GET /api/v1/todos", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request("/api/v1/todos", {}, testEnv);
    expect(res.status).toBe(401);
  });

  it("returns empty list when no todos", async () => {
    const res = await authedFetch("/api/v1/todos");
    expect(res.status).toBe(200);
    const body = await res.json<{ todos: unknown[]; total: number }>();
    expect(body.todos).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns paginated todos sorted by createdAt desc", async () => {
    await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ title: "First" }),
    });
    // Wait until the next Unix second so "Second" gets a strictly larger createdAt
    await new Promise<void>((r) =>
      setTimeout(r, 1000 - (Date.now() % 1000) + 10),
    );
    await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ title: "Second" }),
    });

    const res = await authedFetch("/api/v1/todos");
    const body = await res.json<{
      todos: Array<{ title: string }>;
      total: number;
      totalPages: number;
    }>();
    expect(body.total).toBe(2);
    expect(body.todos[0].title).toBe("Second");
    expect(body.todos[1].title).toBe("First");
  });

  it("filters by status", async () => {
    await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ title: "A", status: "todo" }),
    });
    await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ title: "B", status: "done" }),
    });

    const res = await authedFetch("/api/v1/todos?status=done");
    const body = await res.json<{
      todos: Array<{ title: string }>;
      total: number;
    }>();
    expect(body.total).toBe(1);
    expect(body.todos[0].title).toBe("B");
  });
});

describe("POST /api/v1/todos", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(
      "/api/v1/todos",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test" }),
      },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("creates a todo and returns 201", async () => {
    const res = await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({
        title: "New Todo",
        description: "desc",
        status: "in_progress",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json<{
      id: string;
      title: string;
      status: string;
    }>();
    expect(body.title).toBe("New Todo");
    expect(body.status).toBe("in_progress");
    expect(body.id).toBeTruthy();
  });

  it("returns 422 when title is missing", async () => {
    const res = await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ description: "no title" }),
    });
    expect(res.status).toBe(422);
  });
});

describe("GET /api/v1/todos/:todoId", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request("/api/v1/todos/some-id", {}, testEnv);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent todo", async () => {
    const res = await authedFetch("/api/v1/todos/non-existent-id");
    expect(res.status).toBe(404);
  });

  it("returns the todo for the owner", async () => {
    const createRes = await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ title: "My Todo" }),
    });
    const { id } = await createRes.json<{ id: string }>();

    const res = await authedFetch(`/api/v1/todos/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json<{ title: string }>();
    expect(body.title).toBe("My Todo");
  });

  it("returns 403 when accessing another user's todo", async () => {
    const res2 = await app.request(
      "/api/auth/sign-up/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "other@example.com",
          password: "password123",
          name: "Other",
        }),
      },
      testEnv,
    );
    const { token: token2 } = await res2.json<{ token: string }>();

    const createRes = await app.request(
      "/api/v1/todos",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token2}`,
        },
        body: JSON.stringify({ title: "User2 Todo" }),
      },
      testEnv,
    );
    const { id } = await createRes.json<{ id: string }>();

    const res = await authedFetch(`/api/v1/todos/${id}`);
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/v1/todos/:todoId", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(
      "/api/v1/todos/some-id",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "x",
          description: null,
          status: "todo",
          dueDate: null,
        }),
      },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("updates and returns the todo", async () => {
    const createRes = await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ title: "Old Title" }),
    });
    const { id } = await createRes.json<{ id: string }>();

    const res = await authedFetch(`/api/v1/todos/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: "New Title",
        description: "updated",
        status: "done",
        dueDate: null,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ title: string; status: string }>();
    expect(body.title).toBe("New Title");
    expect(body.status).toBe("done");
  });

  it("returns 422 when status is invalid", async () => {
    const createRes = await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ title: "T" }),
    });
    const { id } = await createRes.json<{ id: string }>();

    const res = await authedFetch(`/api/v1/todos/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: "T",
        description: null,
        status: "invalid",
        dueDate: null,
      }),
    });
    expect(res.status).toBe(422);
  });
});

describe("DELETE /api/v1/todos/:todoId", () => {
  it("returns 401 without auth", async () => {
    const res = await app.request(
      "/api/v1/todos/some-id",
      { method: "DELETE" },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("deletes a todo and returns 204", async () => {
    const createRes = await authedFetch("/api/v1/todos", {
      method: "POST",
      body: JSON.stringify({ title: "To Delete" }),
    });
    const { id } = await createRes.json<{ id: string }>();

    const res = await authedFetch(`/api/v1/todos/${id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    const getRes = await authedFetch(`/api/v1/todos/${id}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 403 when deleting another user's todo", async () => {
    const res2 = await app.request(
      "/api/auth/sign-up/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "del-other@example.com",
          password: "password123",
          name: "Other",
        }),
      },
      testEnv,
    );
    const { token: token2 } = await res2.json<{ token: string }>();

    const createRes = await app.request(
      "/api/v1/todos",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token2}`,
        },
        body: JSON.stringify({ title: "Other's Todo" }),
      },
      testEnv,
    );
    const { id } = await createRes.json<{ id: string }>();

    const res = await authedFetch(`/api/v1/todos/${id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
