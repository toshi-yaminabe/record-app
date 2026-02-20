# Deployment Guide

record-appのデプロイ手順（Vercel + Supabase構成）

---

## 前提条件

- Supabaseアカウント
- Vercelアカウント
- GitHubリポジトリ (`toshi-yaminabe/record-app`)
- Google Gemini APIキー

---

## 1. Supabaseプロジェクトのセットアップ

### 1.1 プロジェクト情報

- **プロジェクトID**: `dhwuekyutobpnocwhdut`
- **リージョン**: `ap-northeast-1` (東京)
- **プロジェクトURL**: `https://dhwuekyutobpnocwhdut.supabase.co`

### 1.2 データベース接続情報の取得

Supabase Dashboard > Settings > Database > Connection string から以下を取得:

#### Transaction mode (PgBouncer経由)
```
postgresql://postgres.dhwuekyutobpnocwhdut:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&statement_cache_size=0
```

#### Session mode (マイグレーション用)
```
postgresql://postgres.dhwuekyutobpnocwhdut:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

パスワードは Supabase Dashboard > Settings > Database > Database Password からリセット可能。

### 1.3 APIキーの取得

Supabase Dashboard > Settings > API から以下を取得:

- **anon key** (公開用): クライアントアプリで使用
- **service_role key** (サーバー専用): RLSをバイパス、**絶対にクライアントに公開しない**

### 1.4 Edge Function Secretsの設定

Supabase Dashboard > Edge Functions > process-audio > Secrets で以下を設定:

| Secret名 | 値 | 備考 |
|---------|---|------|
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studioから取得 |

**注意**: `SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`は自動提供されるため設定不要。

---

## 2. Vercelプロジェクトのセットアップ

### 2.1 プロジェクトの作成

```bash
cd ~/apps/record-app
vercel
```

プロンプトに従ってプロジェクトを作成。

### 2.2 環境変数の設定

Vercel Dashboard > Settings > Environment Variables で以下を設定:

| 変数名 | 値 | 環境 | 備考 |
|--------|---|------|------|
| `DATABASE_URL` | `postgresql://postgres.dhwuekyutobpnocwhdut:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&statement_cache_size=0` | Production, Preview, Development | Transaction mode |
| `DIRECT_URL` | `postgresql://postgres.dhwuekyutobpnocwhdut:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres` | Production, Preview, Development | Session mode |
| `SUPABASE_URL` | `https://dhwuekyutobpnocwhdut.supabase.co` | Production, Preview, Development | プロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dhwuekyutobpnocwhdut.supabase.co` | Production, Preview, Development | クライアント用 |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Production, Preview, Development | Service Role Key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Production, Preview, Development | Anon Key |
| `GEMINI_API_KEY` | `AIzaSy...` | Production, Preview, Development | Google Gemini API |
| `ENCRYPTION_KEY` | (任意) 32バイトhex | Production | DB保存APIキー暗号化用 |
| `CRON_SECRET` | (任意) ランダム文字列 | Production | タスク自動アーカイブ用 |

**ENCRYPTION_KEYの生成方法**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 デプロイ

```bash
vercel --prod
```

---

## 3. データベースのセットアップ

### 3.1 マイグレーションの実行

ローカル環境で `.env` ファイルを作成し、Supabase接続情報を設定:

```bash
cp .env.example .env
# .env を編集してDATABASE_URLとDIRECT_URLを設定
```

マイグレーション実行:

```bash
npx prisma generate
npx prisma migrate deploy
node prisma/seed.mjs
```

### 3.2 動作確認

Supabase Dashboard > Table Editor で以下のテーブルが作成されていることを確認:

- `bunjins` (5件のデフォルト分人)
- `sessions`
- `segments`
- `tasks`
- `proposals`
- その他14モデル

---

## 4. Flutter APKのビルド

### 4.1 本番APKビルド

```bash
cd ~/apps/record-app/flutter_app
flutter build apk --release --dart-define=API_BASE_URL=https://record-app-one.vercel.app
```

### 4.2 GitHub Releasesへのアップロード

1. GitHub > Releases > Draft a new release
2. Tag version (例: `v1.5.2`)
3. Release title (例: `v1.5.2 - Supabase移行完了`)
4. APKファイルをアップロード (`build/app/outputs/flutter-apk/app-release.apk`)
5. Publish release

---

## 5. トラブルシューティング

### Vercelでデータベース接続エラー

**症状**: `database: false` または `Connection refused`

**原因**: `DATABASE_URL` が設定されていない、または間違っている

**解決策**:
1. Vercel Dashboard > Settings > Environment Variables で `DATABASE_URL` を確認
2. Supabase Dashboard > Settings > Database > Connection string から正しい接続文字列をコピー
3. Vercelプロジェクトを再デプロイ (`vercel --prod`)

### Edge Functionでのエラー

**症状**: 音声文字起こしが失敗する

**原因**: `GEMINI_API_KEY` が設定されていない

**解決策**:
1. Supabase Dashboard > Edge Functions > process-audio > Secrets
2. `GEMINI_API_KEY` を追加
3. Edge Functionを再デプロイ (または新しいバージョンをデプロイ)

### Prisma migrateエラー

**症状**: `prisma migrate deploy` で "Prepared statements not supported" エラー

**原因**: Transaction mode (port 6543) では prepared statements が使えない

**解決策**:
1. `DIRECT_URL` (Session mode) を `.env` に設定
2. `prisma/schema.prisma` で `directUrl` を使用していることを確認

---

## 6. 監視とメンテナンス

### Vercel

- Vercel Dashboard > Deployments でデプロイ履歴を確認
- Vercel Dashboard > Analytics でパフォーマンスを監視
- Vercel Dashboard > Logs でエラーログを確認

### Supabase

- Supabase Dashboard > Database > Tables でデータを確認
- Supabase Dashboard > Logs でクエリログを確認
- Supabase Dashboard > Edge Functions > process-audio > Logs でEdge Functionのログを確認

### GitHub Issues

- [GitHub Issues](https://github.com/toshi-yaminabe/record-app/issues) で課題を管理
- コミットメッセージに `fix #N` または `see #N` を含めて課題にリンク

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
