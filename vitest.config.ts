import {
  cloudflarePool,
  cloudflareTest,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const poolOptions = {
  main: "./src/index.ts",
  wrangler: { configPath: "./wrangler.toml" },
  miniflare: {
    bindings: {
      SKIP_EMAIL_VERIFICATION: "true",
      BETTER_AUTH_SECRET: "test-secret-for-testing-only",
      APP_URL: "http://localhost",
      RESEND_API_KEY: "test",
    },
  },
};

export default defineConfig({
  plugins: [cloudflareTest(poolOptions)],
  test: {
    pool: cloudflarePool(poolOptions),
    setupFiles: ["./tests/setup.ts"],
    // better-auth leaks an uncaught APIError in Workerd when sign-in fails with wrong credentials.
    // The 401 response is returned correctly; this is a better-auth bug in the Workerd async context.
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
