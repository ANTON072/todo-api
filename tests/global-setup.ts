import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function setup() {
  const sql = postgres(process.env.DATABASE_URL as string);
  await migrate(drizzle(sql), { migrationsFolder: "drizzle/migrations" });
  await sql.end();
}
