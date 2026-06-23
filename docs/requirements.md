# Todo API

TodoアプリのREST APIを作ります。
クライアント構築の練習のためのAPIなので、そこまでセキュアでなくてもOK。
ログインやJWTの認証はクライアント側で試せるようにちゃんと作りたい。
お金はかけたくない。

## エンドポイント

### 認証（better-auth が自動生成）

- `POST /api/auth/sign-up/email` — ユーザー登録
- `POST /api/auth/sign-in/email` — ログイン
- `POST /api/auth/sign-out` — ログアウト
- `GET /api/auth/session` — ユーザー情報取得
- `POST /api/auth/update-user` — ユーザー情報更新
- `DELETE /api/auth/delete-user` — 退会
- メールアドレス確認フロー（トークン送信・検証）は自動処理

### TODO

- GET `/api/v1/todos`
  - 認証あり
  - TODO一覧
  - ページング
  - createdAtでソート
  - statusでフィルタ
- POST `/api/v1/todos`
  - 認証あり
  - TODO新規作成
- GET `/api/v1/todos/:todoId`
  - 認証あり
  - TODO詳細
- PUT `/api/v1/todos/:todoId`
  - 認証あり
  - TODO編集
- DELETE `/api/v1/todos/:todoId`
  - 認証あり
  - TODO削除

## 主な要件

- メールアドレスでサインアップおよびログインが可能。
- メール送信でメールアドレスを確認する。
- 他人のTODOを閲覧・編集・削除することはできない。
- 削除は物理削除でOK。
- 退会時はそのユーザーに紐づくTODOがすべて削除される。
- JWT認証（better-auth + bearer プラグイン）。`Authorization: Bearer <JWT>`
  - メールアドレス確認トークン有効期限: 1時間
- OpenAPIスキーマファイルの生成（TODO エンドポイントのみ）

## データモデル

### todos

| フィールド | 型 | 備考 |
|---|---|---|
| id | text (UUID) | PK |
| userId | text | FK → users.id |
| title | text | 必須 |
| description | text | nullable |
| status | text enum | `todo` / `in_progress` / `done` |
| dueDate | integer | nullable、Unixタイムスタンプ |
| createdAt | integer | Unixタイムスタンプ |
| updatedAt | integer | Unixタイムスタンプ |

※ users テーブルは better-auth が自動生成

## サーバー要件

- Cloudflare Workers
- Cloudflare D1

## 技術スタック

- TypeScript
- Hono / Hono OpenAPI
- better-auth（bearer プラグイン含む）
- Drizzle ORM
- Zod 4系
- Biome 2系
- Resend（メール送信）

## テスト計画

### テスト戦略

エンドポイントの結合テストのみ実施する。ユニットテストは行わない。

### 使用ツール

- **Vitest** — テストランナー
- **`@cloudflare/vitest-pool-workers`** — Miniflare（Workers ローカルエミュレータ）上でテストを実行するプール。Workerd ランタイムで動くため D1 バインディングをモックなしで使用可能。

### ファイル構成

```
tests/
  auth.test.ts   # 認証エンドポイント
  todos.test.ts  # TODO エンドポイント
```

### セットアップ方針

- `beforeAll` でテスト用ユーザーを作成し JWT を取得する
- `beforeEach` で D1 のデータをリセットする
- `SELF.fetch()` で HTTP リクエストを送信してレスポンスを検証する

### カバー範囲

| ケース | 確認内容 |
|---|---|
| 認証なしリクエスト | 401 が返る |
| 他人の TODO へのアクセス | 403 が返る |
| 存在しない TODO へのアクセス | 404 が返る |
| バリデーションエラー | 400/422 が返る |
| 各エンドポイントの正常系 | ステータスコードとレスポンス形状が正しい |
