import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { handle } from "hono/aws-lambda";
import app from "./index";
import type { Env } from "./types";

const sm = new SecretsManagerClient({});

async function fetchSecret(arn: string): Promise<Record<string, string>> {
  const res = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
  return JSON.parse(res.SecretString ?? "{}");
}

async function loadEnv(): Promise<Env> {
  const dbSecretArn = process.env.DB_SECRET_ARN;
  const appSecretArn = process.env.APP_SECRET_ARN;

  // ローカル実行 or テスト: Secrets Managerを使わず process.env から読む
  if (!dbSecretArn || !appSecretArn) {
    return {
      DATABASE_URL: process.env.DATABASE_URL as string,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET as string,
      RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
      APP_URL: process.env.APP_URL as string,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION,
    };
  }

  // Lambda on AWS: Secrets Managerから認証情報を取得
  const [db, appSec] = await Promise.all([
    fetchSecret(dbSecretArn),
    fetchSecret(appSecretArn),
  ]);

  // RDSシークレットのフォーマット: {username, password, host, port, dbname}
  const DATABASE_URL = `postgresql://${db.username}:${encodeURIComponent(db.password)}@${db.host}:${db.port}/${db.dbname}?sslmode=require`;

  return {
    DATABASE_URL,
    BETTER_AUTH_SECRET: appSec.BETTER_AUTH_SECRET,
    RESEND_API_KEY: appSec.RESEND_API_KEY ?? "",
    APP_URL: process.env.APP_URL ?? appSec.APP_URL,
    ALLOWED_ORIGINS: appSec.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS,
    SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION,
  };
}

// コールドスタート時に即座に開始し、以降の呼び出しでキャッシュを再利用する
const envPromise = loadEnv();

export const handler = handle({
  fetch: async (req: Request) => {
    const env = await envPromise;
    return app.fetch(req, env);
  },
} as unknown as typeof app);
