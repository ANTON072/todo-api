# コードガイドライン

## ディレクトリ構成

```
src/
  index.ts              # エントリーポイント（アプリ初期化・ミドルウェア登録）
  types.ts              # Env 型定義（Cloudflare Workers バインディング）
  routes/
    index.ts            # ルート集約（アプリ登録のみ）
    v1/
      todos/
        index.ts        # ルート集約
        list.ts         # GET /api/v1/todos
        create.ts       # POST /api/v1/todos
        detail.ts       # GET /api/v1/todos/:todoId
        update.ts       # PUT /api/v1/todos/:todoId
        remove.ts       # DELETE /api/v1/todos/:todoId
  db/
    schema/
      todos.ts          # todos テーブル定義
    index.ts            # DB接続
  middleware/
    auth.ts             # 認証ミドルウェア
    error-handler.ts    # エラーハンドラー
  lib/
    errors.ts           # カスタムエラークラス
scripts/
  gen-openapi.ts        # openapi.json 生成スクリプト
tests/
  auth.test.ts
  todos.test.ts
```

## ルーティング規則

- ファイルパスが URL に対応する（`routes/v1/todos/list.ts` → `GET /api/v1/todos`）
- `index.ts` はルート集約のみ。`GET /` 相当のハンドラーは別ファイル（`list.ts` / `detail.ts`）に置く
- 動的パラメータのルートは `detail.ts` / `update.ts` / `remove.ts` に置く
- 静的パスを動的パスより先に登録してパラメータキャプチャを防ぐ
- 各ルートファイルは Hono アプリインスタンスを `export const xxxRoute = app` で named export する（barrel export 禁止）

```typescript
// routes/v1/todos/list.ts の例
const app = new OpenAPIHono<{ Bindings: Env }>()
const route = createRoute({ method: "get", path: "/", ... })
app.openapi(route, async (c) => { ... })
export const listTodosRoute = app
```

## バリデーション

- リクエスト・レスポンスのスキーマはすべて Zod で定義し `createRoute` に渡す
- `@hono/zod-openapi` の `createRoute` + `app.openapi()` を使うことで OpenAPI 仕様を自動生成する
- 直接 `app.get()` / `app.post()` は使わない（OpenAPI に含まれなくなるため）
- `app.openapi()` のバリデーション失敗はデフォルトで 400 を返すため、`OpenAPIHono` の `defaultHook` で 422 に統一する

```typescript
const app = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          type: "about:blank",
          title: "Unprocessable Entity",
          status: 422,
          detail: "Request body validation failed",
          errors: result.error.errors.map((e) => ({
            path: e.path.map(String),
            message: e.message,
          })),
        },
        422,
        { "Content-Type": "application/problem+json" },
      )
    }
  },
})
```

## エラーレスポンス

全エラーは [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) 形式で返す。
Content-Type は `application/problem+json`。

```typescript
// lib/errors.ts
export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}
export class ValidationError extends Error {}
```

エラーハンドラーで一元的にステータスコードへマッピングする。ルートハンドラー内で直接 `c.json(...)` を返さない。

| エラークラス | ステータス | title |
|---|---|---|
| UnauthorizedError | 401 | `Unauthorized` |
| ForbiddenError | 403 | `Forbidden` |
| NotFoundError | 404 | `Not Found` |
| ValidationError | 422 | `Unprocessable Entity` |
| HTTPException (Hono) | そのまま使用 | — |
| その他 | 500 | `Internal Server Error` |

```typescript
// middleware/error-handler.ts の実装例
c.json(
  {
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: err.message,
  },
  404,
  { "Content-Type": "application/problem+json" },
)
```

## 認証

- better-auth の認証エンドポイント（`/api/auth/*`）は自前で実装しない
- TODO エンドポイントはすべて `requireAuth` ミドルウェアで保護する
- `Authorization: Bearer <token>` からセッションを取得し、`c.set("user", user)` でコンテキストに乗せる
- セッションが取得できない場合（未認証）は `requireAuth` 内で `UnauthorizedError` を投げる
- 他人の TODO へのアクセスはハンドラー内で `todo.userId !== user.id` を確認して `ForbiddenError` を投げる

## データベース

- スキーマ定義は `src/db/schema/` 以下にテーブルごとにファイルを分ける
- `dueDate` / `createdAt` / `updatedAt` は Unix タイムスタンプ（秒）の integer で保存する
- `createdAt` はハンドラー内で手動セットせず、Drizzle の `$defaultFn` で自動設定する
- `updatedAt` はハンドラー内で手動更新せず、Drizzle の `$onUpdateFn` で自動更新する
- クエリはルートハンドラーに直接書く（単純な CRUD はリポジトリ層を設けない）
- D1 クライアントはリクエストごとに `drizzle(c.env.DB)` で生成する（グローバルに保持しない）

```typescript
// スキーマの自動設定例
createdAt: integer("created_at").$defaultFn(() => Math.floor(Date.now() / 1000))
updatedAt: integer("updated_at").$onUpdateFn(() => Math.floor(Date.now() / 1000))

// NG: ハンドラー内で手動セット
await db.update(todos).set({ title, updatedAt: Math.floor(Date.now() / 1000) })

// OK: スキーマの $onUpdateFn に任せる
await db.update(todos).set({ title })
```

## Cloudflare Workers 固有

- `Env` 型を `src/types.ts` で定義し、`Hono<{ Bindings: Env }>` に渡す
- D1 バインディングは `c.env.DB` からのみアクセスし、`drizzle(c.env.DB)` でクライアントを生成する
- Node.js ビルトイン（`fs`、`path` など）は使用できないため使わない
- グローバル変数でDB接続を保持しない（リクエストごとに `drizzle(c.env.DB)` を呼ぶ）

## OpenAPI 生成

- `scripts/gen-openapi.ts` を `pnpm run gen-openapi` で実行し `openapi.json` を出力する
- TODO エンドポイント（`/api/v1/*`）のみをスキーマに含める（better-auth のルートは含めない）
- `openapi.json` は Git 管理対象とし、デプロイ前に必ず再生成してコミットする

## テスト

テストランナーは **Vitest + `@cloudflare/vitest-pool-workers`** を使う。`@cloudflare/vitest-pool-workers` が Workerd ランタイム上でテストを実行するため、D1 バインディングをモックなしで使用できる。実行は `pnpm test`。

- `SELF.fetch()` でHTTPリクエストを送り、ステータスコードとレスポンス形状を検証する
- `beforeAll` でテストユーザーを作成してセッショントークンを取得する
- `beforeEach` で D1 データをリセットしてテスト間の状態干渉を防ぐ
- メールアドレス確認はテスト環境でスキップする。アプリ側で `env.SKIP_EMAIL_VERIFICATION === "true"` を確認し、better-auth の `sendVerificationEmail` を空実装に差し替える
- ユニットテストは書かない。結合テストのみ

## コードスタイル

- フォーマッター・リンターは Biome を使う（ESLint / Prettier は使わない）
- `any` 型は禁止。`unknown` を使い型ガードで絞り込む
- named export のみ使用。`export default` は使わない
- barrel export（`export * from`）は使わない
