# TODO API

フロントエンドの練習で使う用のTODOリストAPI。JWT認証つき。  
Cloudflare Workers / Cloudflare D1で動きます。

## 事前準備

1. `pnpm install` の実行。
2. メール送信に[Resend](https://resend.com/)を利用しています。アカウントを作成し、APIキーを取得します。
3. `.dev.vars.example` を `.dev.vars` にコピーして内容を適切なものに変更します。

## ローカル環境

```sh
# Cloudflareにログイン
pnpm wrangler login

# D1データベースの作成
pnpm wrangler d1 create todo-db
# 出力された database_id を wrangler.toml の [[d1_databases]] > database_id に貼り付ける

# マイグレーションの実行
pnpm wrangler d1 migrations apply todo-db --local

# ローカルサーバーの起動
pnpm wrangler dev
```

## スキーマ変更時

`src/db/schema.ts` などのスキーマを変更した場合は、以下の順で実行する。

```sh
# 変更差分からマイグレーションファイルを生成（drizzle/migrations/ に出力）
pnpm db:generate

# ローカルのD1に適用
pnpm wrangler d1 migrations apply todo-db --local

# 本番のD1に適用（本番反映時）
pnpm wrangler d1 migrations apply todo-db --remote
```

## 本番環境

```sh
# D1データベースの作成（ローカル環境と共用している場合はスキップ）
pnpm wrangler d1 create todo-db
# 出力された database_id を wrangler.toml の [[d1_databases]] > database_id に貼り付ける

# マイグレーションの実行
pnpm wrangler d1 migrations apply todo-db --remote

# 環境変数のセット
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put RESEND_API_KEY
pnpm wrangler secret put APP_URL

# デプロイ
pnpm wrangler deploy
```
