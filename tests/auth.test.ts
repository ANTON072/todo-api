import { env, SELF } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { account, session, user, verification } from "../src/db/schema/auth";
import { applyMigrations } from "./apply-migrations";

const BASE = "http://localhost";

async function signUp(email: string, password: string, name: string) {
  return SELF.fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
}

async function signIn(email: string, password: string) {
  return SELF.fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

beforeAll(async () => {
  await applyMigrations();
});

beforeEach(async () => {
  const db = drizzle(env.DB);
  await db.delete(verification);
  await db.delete(session);
  await db.delete(account);
  await db.delete(user);
});

describe("POST /api/auth/sign-up/email", () => {
  it("creates a new user and returns a token", async () => {
    const res = await signUp("test@example.com", "password123", "Test User");
    expect(res.status).toBe(200);
    const body = await res.json<{ token: string; user: { email: string } }>();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe("test@example.com");
  });

  it("returns 422 when email is missing", async () => {
    const res = await SELF.fetch(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "password123", name: "Test" }),
    });
    // better-auth validates its own fields and returns 400, not 422
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/sign-in/email", () => {
  it("returns a token for valid credentials", async () => {
    await signUp("test@example.com", "password123", "Test User");
    const res = await signIn("test@example.com", "password123");
    expect(res.status).toBe(200);
    const body = await res.json<{ token: string }>();
    expect(body.token).toBeTruthy();
  });

  it("returns error for wrong password", async () => {
    await signUp("test@example.com", "password123", "Test User");
    const res = await signIn("test@example.com", "wrongpassword");
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/auth/get-session", () => {
  it("returns session for authenticated user", async () => {
    const signUpRes = await signUp(
      "test@example.com",
      "password123",
      "Test User",
    );
    const { token } = await signUpRes.json<{ token: string }>();

    const res = await SELF.fetch(`${BASE}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ user: { email: string } }>();
    expect(body.user.email).toBe("test@example.com");
  });

  it("returns null session without auth", async () => {
    const res = await SELF.fetch(`${BASE}/api/auth/get-session`);
    // better-auth returns 200 with null body (not an object) when not authenticated
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });
});
