# Todo API

TodoアプリのREST APIを作ります。
クライアント構築の練習のためのAPIなので、そこまでセキュアでなくてもOK。
ログインやBearer認証はクライアント側で試せるようにちゃんと作りたい。
お金はかけたくない。

## エンドポイント

### 認証（better-auth が自動生成）

- `POST /api/auth/sign-up/email` — ユーザー登録
- `POST /api/auth/sign-in/email` — ログイン
- `POST /api/auth/sign-out` — ログアウト
- `GET /api/auth/session` — ユーザー情報取得
- `POST /api/auth/update-user` — ユーザー情報更新
- 退会（HTTP メソッド・パスは better-auth の実装に依存。実装時に確認する）
- メールアドレス確認フロー（トークン送信・検証）は自動処理

### TODO

- GET `/api/v1/todos`
  - 認証あり
  - TODO一覧
  - ページング: `?page=1&limit=20`（デフォルト: page=1, limit=20）
  - ソート: `createdAt` 降順（新しい順）
  - フィルタ: `?status=todo|in_progress|done`（省略時は全件）
  - レスポンス: `{ todos, total, page, limit, totalPages }`
- POST `/api/v1/todos`
  - 認証あり
  - TODO新規作成
  - レスポンス: 201 + 作成した todo オブジェクト
- GET `/api/v1/todos/:todoId`
  - 認証あり
  - TODO詳細
  - レスポンス: 200 + todo オブジェクト
- PUT `/api/v1/todos/:todoId`
  - 認証あり
  - TODO編集（全フィールド必須の完全置換）
  - レスポンス: 200 + 更新後の todo オブジェクト
- DELETE `/api/v1/todos/:todoId`
  - 認証あり
  - TODO削除
  - レスポンス: 204 No Content

## 主な要件

- メールアドレスでサインアップおよびログインが可能。
- メール送信でメールアドレスを確認する。
- 他人のTODOを閲覧・編集・削除することはできない。
- 削除は物理削除でOK。
- 退会時はそのユーザーに紐づくTODOがすべて削除される（`ON DELETE CASCADE`）。
- Bearer トークン認証（better-auth bearer プラグイン）。`Authorization: Bearer <token>`
  - トークンの実体はD1に保存されたセッショントークン（JWTではない）
  - メールアドレス確認トークン有効期限: 1時間
- OpenAPIスキーマを `openapi.json` としてビルド時に静的ファイル出力（TODO エンドポイントのみ）
  - npm script で生成する

## エラーレスポンス

全エラーは以下の形式で返す:

```json
{ "error": "エラーメッセージ" }
```

| ケース | ステータス |
|---|---|
| 未認証 | 401 |
| 権限なし（他人の TODO） | 403 |
| リソース不存在 | 404 |
| バリデーションエラー | 422 |

## データモデル

### todos

| フィールド | 型 | 備考 |
|---|---|---|
| id | text (UUID) | PK |
| userId | text | FK → users.id（ON DELETE CASCADE） |
| title | text | 必須 |
| description | text | nullable |
| status | text enum | `todo` / `in_progress` / `done` |
| dueDate | integer | nullable、Unix タイムスタンプ（秒単位） |
| createdAt | integer | Unix タイムスタンプ（秒単位）、サーバー自動設定 |
| updatedAt | integer | Unix タイムスタンプ（秒単位）、サーバー自動更新 |

※ users テーブルは better-auth が自動生成

## サーバー要件

- Cloudflare Workers
- Cloudflare D1

## 技術スタック

Node.js 24以上 / pnpm 11以上

- TypeScript
- Hono + `@hono/zod-openapi`
- better-auth（bearer プラグイン）
- Drizzle ORM
- Zod v3
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

- `beforeAll` でテスト用ユーザーを作成しセッショントークンを取得する
- `beforeEach` で D1 のデータをリセットする
- `SELF.fetch()` で HTTP リクエストを送信してレスポンスを検証する
- テスト環境ではメールアドレス確認をスキップする（環境変数で切り替え）

### カバー範囲

| ケース | 確認内容 |
|---|---|
| 認証なしリクエスト | 401 が返る |
| 他人の TODO へのアクセス | 403 が返る |
| 存在しない TODO へのアクセス | 404 が返る |
| バリデーションエラー | 422 が返る |
| 各エンドポイントの正常系 | ステータスコードとレスポンス形状が正しい |
