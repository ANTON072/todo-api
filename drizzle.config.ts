import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["src/db/schema/auth.ts", "src/db/schema/todos.ts"],
  out: "drizzle/migrations",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    databaseId: "52a8e637-705a-451f-8fb2-255b71930635",
    token: process.env.CLOUDFLARE_D1_TOKEN ?? "",
  },
});
