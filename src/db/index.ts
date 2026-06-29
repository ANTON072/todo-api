import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Env } from "../types";

// Singleton client: reused across Lambda invocations within the same container
let client: ReturnType<typeof postgres> | undefined;

export function createDb(env: Env) {
  if (!client) {
    client = postgres(env.DATABASE_URL);
  }
  return drizzle(client);
}
