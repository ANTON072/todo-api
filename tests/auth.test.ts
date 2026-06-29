import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { account, session, user, verification } from "../src/db/schema/auth";
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

async function signUp(email: string, password: string, name: string) {
  return app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    },
    testEnv,
  );
}

async function signIn(email: string, password: string) {
  return app.request(
    "/api/auth/sign-in/email",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    testEnv,
  );
}

beforeEach(async () => {
  await db.delete(verification);
  await db.delete(session);
  await db.delete(account);
  await db.delete(user);
});

afterAll(async () => {
  await sql.end();
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
    const res = await app.request(
      "/api/auth/sign-up/email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "password123", name: "Test" }),
      },
      testEnv,
    );
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

    const res = await app.request(
      "/api/auth/get-session",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ user: { email: string } }>();
    expect(body.user.email).toBe("test@example.com");
  });

  it("returns null session without auth", async () => {
    const res = await app.request("/api/auth/get-session", {}, testEnv);
    // better-auth returns 200 with null body (not an object) when not authenticated
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });
});
