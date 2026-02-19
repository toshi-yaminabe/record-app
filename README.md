# record-app

Flutter モバイルアプリと Next.js ウェブダッシュボードを備えた、フルスタック音声録音・AI文字起こしアプリケーション。

## 📱 ダウンロード

**[⬇️ 最新版をダウンロード](https://github.com/toshi-yaminabe/record-app/releases)**

Android デバイス向けの最新版 APK をダウンロードできます。

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (プロジェクトID: `dhwuekyutobpnocwhdut`)
- Google Gemini API key

### Installation

1. **依存関係のインストール**

```bash
npm install
# or
yarn install
```

2. **環境変数の設定**

`.env.example`をコピーして`.env`を作成し、必要な値を設定:

```bash
cp .env.example .env
```

必須の環境変数:
- `DATABASE_URL`: Supabase PostgreSQL接続文字列（Transaction mode）
- `DIRECT_URL`: Supabase PostgreSQL直接接続（Session mode、マイグレーション用）
- `SUPABASE_URL`: `https://dhwuekyutobpnocwhdut.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard > Settings > API > service_role key
- `GEMINI_API_KEY`: Google AI Studio から取得 (https://aistudio.google.com/app/apikey)

詳細は`.env.example`を参照してください。

3. **データベースのセットアップ**

```bash
npx prisma generate
npx prisma migrate deploy
node prisma/seed.mjs
```

> ⚠️ **重要**: `npx prisma migrate deploy` を実行せずに起動すると、
> テーブル定義/RLS設定の不整合により `500 Internal server error` が継続的に発生します。
> とくに `20260217123000_enable_rls_with_policies` を未適用の環境では、
> 認可ポリシー未整備で複数API（tasks/bunjins/proposals/transcribe）が同時に失敗する原因になります。

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Production (Vercel)

1. **Vercelプロジェクトを作成**

```bash
vercel
```

2. **環境変数を設定**

Vercel Dashboard > Settings > Environment Variables で以下を設定:

| 変数名 | 値 | 備考 |
|--------|---|------|
| `DATABASE_URL` | `postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&statement_cache_size=0` | Supabase Dashboard > Settings > Database > Transaction mode |
| `DIRECT_URL` | `postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres` | Session mode（Prisma migrate用） |
| `SUPABASE_URL` | `https://dhwuekyutobpnocwhdut.supabase.co` | プロジェクトURL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Supabase Dashboard > Settings > API |
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio |
| `ENCRYPTION_KEY` | (任意) | 32バイトhex、未設定時はDATABASE_URLハッシュ使用 |
| `CRON_SECRET` | (任意) | タスク自動アーカイブ用 |

3. **デプロイ**

```bash
vercel --prod
```

### Edge Function Setup (Supabase)

音声文字起こし処理はSupabase Edge Functionで実行されます。

1. **Edge Function Secretsを設定**

Supabase Dashboard > Edge Functions > process-audio > Secrets で以下を設定:

| Secret名 | 値 | 備考 |
|---------|---|------|
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio |

`SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`は自動提供されるため設定不要です。

2. **動作確認**

FlutterアプリまたはNext.js管理画面から音声録音→文字起こしが正常に動作することを確認してください。

### Linting

Run ESLint:

```bash
npm run lint
```

## Project Structure

### Current Implementation
- `/app` - Next.js App Router pages and layouts
- `/public` - Static assets
- `next.config.js` - Next.js configuration
- `jsconfig.json` - JavaScript configuration with path aliases

### Future Requirements
- `/future/requirements/` - **将来実装予定の要件定義書（現在のスコープ外）**
  - これらは参考用途で、現在のプロジェクト要件ではありません
  - 実装時期は別途調整が必要です

## UI / Design Docs

- `docs/ui-concept-bunjin-visual-signature.md` - 分人識別を強化するUIコンセプト（アプリ/WEB共通）

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js GitHub repository](https://github.com/vercel/next.js)