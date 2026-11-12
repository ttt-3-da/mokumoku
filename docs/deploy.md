# デプロイ手順（Supabase + Vercel）

秘密情報（キー・パスワード）はリポジトリに入れず、各サービスの管理画面か環境変数で設定します。

## 1. GitHub にリポジトリを作る

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/mokumoku.git
git push -u origin main
```

`.env.local` は `.gitignore` で除外されているので、プッシュされません。

## 2. Supabase のプロジェクトを作る

1. <https://supabase.com/dashboard> で New project を作成（リージョンは Tokyo がおすすめ）
2. **Authentication → Sign In / Providers → Email**
   - 「Confirm email」を **オフ** にする（このアプリはメールを送りません）
3. **Authentication → URL Configuration**
   - Site URL：Vercel の本番URL（例 `https://mokumoku.vercel.app`）
4. ローカルからマイグレーションを流す

```bash
npx supabase login
npx supabase link --project-ref <プロジェクトのRef>
npx supabase db push
```

`db push` で `supabase/migrations/` のすべて（テーブル・RLS・RPC・Realtime の認可・pg_cron のジョブ）が適用されます。
`seed.sql`（デモユーザー）は本番には入りません。

5. **Project Settings → API Keys** で `Publishable key` を控える

> メモ：ログインIDは内部で `{username}@users.mokumoku.invalid` というダミーのメールアドレスに変換しています。
> 本番でサインアップできない場合は、Authentication の設定でメールアドレスのドメイン制限がないか確認してください。

## 3. Vercel にデプロイする

1. <https://vercel.com/new> で GitHub のリポジトリを Import
2. Environment Variables に次の2つを設定

| 名前 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 控えた Publishable key |

3. Deploy

デプロイ後、Supabase の Site URL を Vercel の URL に合わせておきます。

> 速さのために、Vercel のサーバーは Supabase と同じ地域で動かします。リポジトリの `vercel.json` で
> `"regions": ["sin1"]`（シンガポール）を指定しています。Supabase を別の地域に作った場合は、
> 近い地域（東京なら `hnd1`）に書き換えてください。

## 4. 確認

- 新規登録 → ロビー → 部屋をつくる → 入室 → 退室 → 投稿 までできること
- 2つのブラウザ（片方はシークレットウィンドウ）で同じ部屋に入り、もちがリアルタイムで並ぶこと
- Supabase の **Integrations → Cron** に `mokumoku-cleanup`（毎分）が登録されていること
