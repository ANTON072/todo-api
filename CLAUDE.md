# TODO API

Cloudflare Workers + D1 で動くシンプルな TODO REST API。

## ドキュメント

タスクに応じて参照すること:

- `docs/requirements.md` — 要件定義（機能・エンドポイント・データモデル）
- `docs/guidelines.md` — コーディング規約（**ファイルを編集・作成する前に必ず読むこと**）

## コマンド

| コマンド | 説明 |
|---|---|
| `pnpm typecheck` | TypeScript 型チェック |
| `pnpm check` | Biome lint + format（自動修正あり） |
| `pnpm test` | 結合テスト（Vitest + Workerd） |
| `pnpm wrangler dev` | ローカル開発サーバー起動 |
| `pnpm wrangler deploy` | Cloudflare Workers へデプロイ |
| `pnpm drizzle-kit generate` | マイグレーションファイル生成 |
| `pnpm drizzle-kit migrate` | D1 へマイグレーション適用 |

## ワークフロー

タスク完了時およびコミット前に必ず以下をすべてパスさせること:

```
pnpm typecheck
pnpm check
pnpm test
```
