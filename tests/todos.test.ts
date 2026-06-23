import { env, SELF } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { account, session, user, verification } from "../src/db/schema/auth";
import { todos } from "../src/db/schema/todos";
import { applyMigrations } from "./apply-migrations";

const BASE = "http://localhost";

let authToken: string;

async function authedFetch(path: string, init?: RequestInit) {
  return SELF.fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      ...(init?.headers as Record<string, string>),
    },
  });
}

beforeAll(async () => {
  const db = drizzle(env.DB);
  await applyMigrations();

  await db.delete(todos);
  await db.delete(verification);
  await db.delete(session);
  await db.delete(account);
  await db.delete(user);

  const res = await SELF.fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "todo@example.com",
      password: "password123",
      name: "Todo User",
    }),
  });
  const body = await res.json<{ token: string }>();
  authToken = body.token;
});

beforeEach(async () => {
  const db = drizzle(env.DB);
  await db.delete(todos);
});

describe("GET /api/v1/todos", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/todos`);
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
    const res = await SELF.fetch(`${BASE}/api/v1/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
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
    const res = await SELF.fetch(`${BASE}/api/v1/todos/some-id`);
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
    // Create a second user
    const res2 = await SELF.fetch(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "other@example.com",
        password: "password123",
        name: "Other",
      }),
    });
    const { token: token2 } = await res2.json<{ token: string }>();

    // Create a todo as user2
    const createRes = await SELF.fetch(`${BASE}/api/v1/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token2}`,
      },
      body: JSON.stringify({ title: "User2 Todo" }),
    });
    const { id } = await createRes.json<{ id: string }>();

    // Try to access as user1
    const res = await authedFetch(`/api/v1/todos/${id}`);
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/v1/todos/:todoId", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/todos/some-id`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "x",
        description: null,
        status: "todo",
        dueDate: null,
      }),
    });
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
    const res = await SELF.fetch(`${BASE}/api/v1/todos/some-id`, {
      method: "DELETE",
    });
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
    const res2 = await SELF.fetch(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "del-other@example.com",
        password: "password123",
        name: "Other",
      }),
    });
    const { token: token2 } = await res2.json<{ token: string }>();

    const createRes = await SELF.fetch(`${BASE}/api/v1/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token2}`,
      },
      body: JSON.stringify({ title: "Other's Todo" }),
    });
    const { id } = await createRes.json<{ id: string }>();

    const res = await authedFetch(`/api/v1/todos/${id}`, { method: "DELETE" });
    expect(res.status).toBe(403);
  });
});
