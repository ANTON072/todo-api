# 実装タスクリスト

## Step 1: 実装前の準備（人間が実施）

- [x] `wrangler login` で Cloudflare 認証
- [x] `wrangler d1 create todo-db` で D1 データベース作成（出力の `database_id` を控える）
- [x] Resend アカウント作成・API キー取得

---

## Step 2: 実装（AI が実施）

### Phase 1: 環境構築

- [x] 依存パッケージのインストール（`hono`, `@hono/zod-openapi`, `better-auth`, `drizzle-orm`, `drizzle-kit`, `zod`, `resend`, `wrangler`, `vitest`, `@cloudflare/vitest-pool-workers`）
- [x] `package.json` scripts の整備（`typecheck`, `check`, `test`, `gen-openapi`, `drizzle-kit generate`, `drizzle-kit migrate`）
- [x] `wrangler.toml` の作成（`name`, `compatibility_date`, D1 バインディング `DB`、Step 1 で控えた `database_id` を設定）
- [x] `tsconfig.json` の作成
- [x] Vitest 設定ファイルの作成（`vitest.config.ts`）

### Phase 2: 基盤コード

- [x] `src/types.ts` — Env 型定義（D1 バインディング `DB`、`ALLOWED_ORIGINS` 等の環境変数）
- [x] `src/lib/errors.ts` — カスタムエラークラス（`UnauthorizedError` / `ForbiddenError` / `NotFoundError` / `ValidationError`）
- [x] `src/db/schema/todos.ts` — todos テーブル定義（`$defaultFn` / `$onUpdateFn` で `createdAt` / `updatedAt` を自動設定）
- [x] `src/db/index.ts` — DB 接続ヘルパー
- [x] `drizzle.config.ts` — Drizzle Kit 設定
- [x] `pnpm drizzle-kit generate` でマイグレーションファイル生成

### Phase 3: 認証（better-auth）

- [x] `src/lib/auth.ts` — better-auth 設定（bearer プラグイン・D1 アダプタ）
- [x] Resend メール送信設定（`sendVerificationEmail` フック）
- [x] `SKIP_EMAIL_VERIFICATION` 環境変数によるテスト環境スキップ対応

### Phase 4: ミドルウェア

- [x] `src/middleware/cors.ts` — CORSミドルウェア（仕様: [requirements.md § CORS](requirements.md#cors)）
- [x] `src/middleware/auth.ts` — `requireAuth`（`c.set("user", user)`; 仕様: [requirements.md § 主な要件](requirements.md#主な要件)）
- [x] `src/middleware/error-handler.ts` — エラーハンドラー（エラークラス→ HTTP ステータスのマッピング）

### Phase 5: TODO エンドポイント

> 各エンドポイントの仕様: [requirements.md § TODO エンドポイント](requirements.md#todo)

- [x] `src/routes/v1/todos/list.ts` — `GET /api/v1/todos`
- [x] `src/routes/v1/todos/create.ts` — `POST /api/v1/todos`
- [x] `src/routes/v1/todos/detail.ts` — `GET /api/v1/todos/:todoId`
- [x] `src/routes/v1/todos/update.ts` — `PUT /api/v1/todos/:todoId`
- [x] `src/routes/v1/todos/remove.ts` — `DELETE /api/v1/todos/:todoId`
- [x] `src/routes/v1/todos/index.ts` — todos ルート集約
- [x] `src/routes/index.ts` — 全ルート集約

### Phase 6: エントリーポイント

- [x] `src/index.ts` — アプリ初期化・ミドルウェア登録・better-auth マウント・ルートマウント

### Phase 7: OpenAPI / Swagger UI

- [x] `GET /api/docs/openapi.json` — OpenAPI スペックを動的に配信
- [x] `GET /api/docs` — Swagger UI（`@hono/swagger-ui`）

### Phase 8: テスト

> テスト仕様: [requirements.md § テスト計画](requirements.md#テスト計画)

- [x] `tests/auth.test.ts` — 認証エンドポイントの結合テスト
- [x] `tests/todos.test.ts` — TODO エンドポイントの結合テスト

### Phase 9: 最終確認

- [x] `pnpm typecheck` パス
- [x] `pnpm check` パス
- [x] `pnpm test` パス

---

## Step 3: ローカル確認 → デプロイ（人間が実施）

### ローカル動作確認

- [x] `.dev.vars` を作成する（Wrangler がローカル実行時に自動で読み込む。`.gitignore` 登録済みであることを確認）
  ```
  BETTER_AUTH_SECRET=<openssl rand -base64 32 で生成した値を貼り付け>
  RESEND_API_KEY=<Resend ダッシュボード → API Keys から取得した値を貼り付け>
  APP_URL=http://localhost:8787
  SKIP_EMAIL_VERIFICATION=true
  # ALLOWED_ORIGINS は未設定でワイルドカード（*）が適用されるため省略可
  ```
- [x] `wrangler d1 migrations apply todo-db --local` でローカル D1 へマイグレーション適用
- [x] `wrangler dev` でローカルサーバーを起動して動作確認

> **環境ごとの変数の流れ**
>
> | 環境 | 読み込み元 | 設定方法 |
> |---|---|---|
> | ローカル開発（`wrangler dev`） | `.dev.vars` | ファイルに直接書く（git 管理外） |
> | テスト（`pnpm test`） | `wrangler.toml` の `[vars]` + `.dev.vars` | センシティブでない値（`SKIP_EMAIL_VERIFICATION=true`）は `wrangler.toml` に書く。シークレット類は `.dev.vars` が参照される |
> | 本番（`wrangler deploy` 後） | Cloudflare の暗号化シークレットストア | `wrangler secret put` で登録。`wrangler.toml` には書かない |

### 本番デプロイ

- [ ] 本番シークレットを登録する（各コマンドを実行すると入力プロンプトが出るので値を貼り付ける）
  ```sh
  wrangler secret put BETTER_AUTH_SECRET   # .dev.vars と同じ値を使うか新たに生成
  wrangler secret put RESEND_API_KEY        # Resend ダッシュボードから取得した値
  wrangler secret put APP_URL               # wrangler deploy 後に表示される Workers URL（例: https://todo-api.username.workers.dev）
  wrangler secret put ALLOWED_ORIGINS       # カンマ区切りの許可オリジン（例: https://example.com,https://app.example.com）
  ```
- [ ] `wrangler d1 migrations apply todo-db` で本番 D1 へマイグレーション適用
- [ ] `wrangler deploy`
