# Life Atlas

Life Atlasは、世界50都市の仕事・移住候補を、同じ計算条件で比較する意思決定アプリです。給与、税金、社会保険、家賃、生活費、貯蓄、購買力、FIRE目安を決定的な計算エンジンで算出し、AIはその結果だけを説明します。

本番サイト: Vercelへ移行中（`main` へのマージで自動デプロイ）。旧公開先: https://life-atlas-global-2026.dreamy-gnat-5451.chatgpt.site/

## 主な機能

- 既存の50都市比較と「次に見るべき3都市」推薦
- 2〜5件の仕事・移住案を比べるOffer Analyzer
- 財務45%、暮らし20%、優先軸25%、データ信頼度10%のLifeAtlas Score
- 給与、家賃、世帯、子ども、為替、支出、貯蓄目標、退職年齢を変えるWhat-If
- 手取り、貯蓄率、LifeAtlas Scoreを基準にした逆転給与の数値探索
- 5年・10年資産予測、FIRE目安、家賃・生活費負担率
- 日本語・英語、ダーク・ライト、スマートフォン表示
- Supabase認証、プロフィール、分析保存・複製・名前変更・削除
- 構造化AI説明、同一結果のキャッシュ、利用回数制限、トークン記録
- Stripe月額・年額Pro、契約状態、顧客ポータル、Webhook反映
- 任意の公開共有ページ、都市・比較SEOページ、プロダクト分析
- 出典、対象範囲、基準日、鮮度、信頼度、未対応計算の明示

税・社会保険モデルが未整備の都市は、手取りや貯蓄を推測せず `—` と表示し、計算可能な都市より上位にしません。50都市の対応範囲は `/data`、計算方法は `/methodology` で確認できます。

## 主要ページ

- `/` — 既存50都市比較
- `/analyze` — Offer Analyzer
- `/dashboard` — 保存した分析
- `/account` — プロフィールと契約
- `/pricing` — Free / Pro
- `/data` — データ範囲と鮮度
- `/methodology` — 計算・スコア方法
- `/cities/[city]` — 都市ページ
- `/compare/[city-a]-vs-[city-b]` — 厳選した都市比較ページ
- `/share/[id]` — ユーザーが明示的に公開した結果

## ローカル起動

Node.js 22.13以上を使用します。

```bash
npm install
npm run dev
```

通常は `http://localhost:3000` で開きます。外部サービスを設定しなくても決定的な計算は動き、認証・AI・課金・公開共有は安全に「未設定」として停止します。

## 環境変数

`.env.example` を `.env.local` にコピーし、必要なサービスだけ設定します。実際の鍵はGitへ保存しません。

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- サーバー処理: `SUPABASE_SERVICE_ROLE_KEY`
- AI: `AI_GATEWAY_API_KEY` または実行環境の `VERCEL_OIDC_TOKEN`
- Stripe: `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、月額・年額のPrice ID
- 公開URL: `NEXT_PUBLIC_SITE_URL`
- 設定診断: `LIFEATLAS_DIAGNOSTICS_TOKEN`（任意）

Supabaseのテーブル、制約、RLS（行単位のアクセス制御）は `supabase/schema.sql` にあります。課金・AI・共有・分析を本番で使う前に、このスキーマを対象プロジェクトへ適用してください。

## 品質確認

```bash
npm run test:unit
npm run lint
npm run build
npm test
git diff --check
```

テストは、主要国の税・社会保険、通貨換算、世帯補正、シナリオ計算、スコア、What-If、逆転給与、FIRE、50都市カタログ、保存入力、共有時の個人情報除外、認証・課金・APIの安全な失敗を確認します。

## 公開

本番はVercelです。`main` へのマージだけが本番デプロイになり、他のブランチはデプロイされません（`vercel.json` の `git.deploymentEnabled`）。

- 環境変数はVercelの Project Settings → Environment Variables に **Production** として登録します。秘密値をPreview・Developmentへ入れる必要はありません。
- 公開URLは `NEXT_PUBLIC_SITE_URL`、未設定ならVercelの本番ドメイン（`VERCEL_PROJECT_PRODUCTION_URL`）を使います。GoogleログインやSEOのURLはこの値から作られます。
- Supabase Authの Redirect URLs に `<本番URL>/api/auth/callback`、Stripe Webhookに `<本番URL>/api/webhooks/stripe` を登録します。
- デプロイ後は、Vercelのデプロイ記録に表示されるコミットSHAと `main` のSHAが一致することを確認します。

本番設定は `scripts/provision-production.mjs` で自動化しています。`VERCEL_TOKEN`、`SUPABASE_ACCESS_TOKEN`、`STRIPE_TEST_SECRET_KEY`（テストモードのみ）を環境変数に置き、`node scripts/provision-production.mjs` で確認、`--apply` で実行します。実行内容は次のとおりです。

- Supabaseのキーを取得してVercelへ登録し、Redirect URLを追加
- StripeのテストPrice（$12/$79）・Webhook・Customer Portalを作成
- Vercelの環境変数（Production）を登録し、再デプロイ
- 診断APIで結果を確認

秘密値は表示しません。live課金、スキーマ適用、削除は行いません。

旧公開先のOpenAI Sites向けファイル（`.openai/hosting.json`、`vite.config.ts`、`worker/`、`build/sites-vite-plugin.ts`）は、移行が完了するまで残しています。

## 本番設定の診断

`LIFEATLAS_DIAGNOSTICS_TOKEN` を設定すると、`GET /api/operations/diagnostics` で環境変数の有無・形式・Stripeのtest/liveを確認できます。`?probe=1` を付けると、読み取り専用で次も確認します。秘密値そのものは返しません。トークン未設定時は404です。

- Supabaseの6テーブルの存在と、anonキーで行が見えないこと
- Google Providerの有効状態
- Stripe Priceの金額・通貨・間隔と表示価格の一致
- Webhookの登録イベント
- Customer Portalの設定
- AI Gatewayに設定モデルが存在すること

```bash
curl -H "Authorization: Bearer $LIFEATLAS_DIAGNOSTICS_TOKEN" "https://<site>/api/operations/diagnostics?probe=1"
```

## 重要な前提

表示額は都市比較用の概算であり、給与明細、税務・金融・移民助言ではありません。扶養控除、給付、雇用形態、州・自治体、医療プランなど、個別条件を完全には再現しません。公式資料、自動取得値、保存参考値、推定値を区別し、確認できない数値をAIや計算エンジンで補いません。
