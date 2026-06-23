import { env } from "cloudflare:test";

// SQL is inlined to avoid file system access in Workerd test environment.
// Regenerate if migrations change: pnpm drizzle-kit generate
const MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`account\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`accountId\` text NOT NULL,
    \`providerId\` text NOT NULL,
    \`userId\` text NOT NULL,
    \`accessToken\` text,
    \`refreshToken\` text,
    \`idToken\` text,
    \`accessTokenExpiresAt\` integer,
    \`refreshTokenExpiresAt\` integer,
    \`scope\` text,
    \`password\` text,
    \`createdAt\` integer NOT NULL,
    \`updatedAt\` integer NOT NULL,
    FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE TABLE IF NOT EXISTS \`session\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`expiresAt\` integer NOT NULL,
    \`token\` text NOT NULL,
    \`createdAt\` integer NOT NULL,
    \`updatedAt\` integer NOT NULL,
    \`ipAddress\` text,
    \`userAgent\` text,
    \`userId\` text NOT NULL,
    FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS \`session_token_unique\` ON \`session\` (\`token\`)`,
  `CREATE TABLE IF NOT EXISTS \`user\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`email\` text NOT NULL,
    \`emailVerified\` integer DEFAULT false NOT NULL,
    \`image\` text,
    \`createdAt\` integer NOT NULL,
    \`updatedAt\` integer NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS \`user_email_unique\` ON \`user\` (\`email\`)`,
  `CREATE TABLE IF NOT EXISTS \`verification\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`identifier\` text NOT NULL,
    \`value\` text NOT NULL,
    \`expiresAt\` integer NOT NULL,
    \`createdAt\` integer,
    \`updatedAt\` integer
  )`,
  `CREATE TABLE IF NOT EXISTS \`todo\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`user_id\` text NOT NULL,
    \`title\` text NOT NULL,
    \`description\` text,
    \`status\` text DEFAULT 'todo' NOT NULL,
    \`due_date\` integer,
    \`created_at\` integer NOT NULL,
    \`updated_at\` integer NOT NULL,
    FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
];

export async function applyMigrations() {
  await env.DB.batch(MIGRATION_STATEMENTS.map((sql) => env.DB.prepare(sql)));
}
