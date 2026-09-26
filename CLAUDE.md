# LifeAtlas — Claude Code向けプロジェクト指針

LifeAtlasは、複数の仕事・移住候補のうち「どれを選ぶべきか、なぜか」を決定的な計算で示す意思決定アプリです。説明・進捗報告は日本語で行います。

## 正とする情報の優先順位
1. ユーザーの最新の明示指示
2. プロダクト要件（PRDはリポジトリに存在しません。追加された場合は `docs/` 配下を最優先で読み、書き換えないこと）
3. 現在の実装と `README.md`
4. Git履歴、`docs/IMPLEMENTATION_STATUS.md`

## 計算の原則（変更禁止）
- 処理順は「入力 → 決定的計算エンジン → 構造化結果 → LifeAtlas Scoreと順位 → AIによる説明」。
- 税・社会保険・生活費の計算は `lib/calculations/legacy-engine.ts` と `calculate-scenario.ts` だけに置き、画面やAPIへ複製しない。片方だけ変えてホームとOffer Analyzerの結果を分岐させない。
- 為替は `lib/data/exchange-rates.ts` の共通スナップショットを使う。ECB非対応通貨は保存参考レートとし、liveとして扱わない。
- LLMに税・控除・為替・生活費・手取り・順位・スコアを計算・推測させない。AIへはサーバーで再計算した結果だけを渡す。
- 計算できない値は `null`（画面では `—`）。平均値やAIで埋めない。税モデル未対応都市は計算可能な都市より上位にしない（Scoreは最大35点）。
- 赤字は0に丸めず負値のまま示す。
- 公式値・自動取得値・保存参考値・推定値を区別し、出典URL・範囲・基準日・信頼度を保持する。国人口を都市人口として扱わない。

## アーキテクチャ
- Next.js 16 App Router + React 19 + TypeScript。本番はVercel。`vercel.json` の `git.deploymentEnabled` で `main` だけを自動デプロイし、他のブランチのプレビューは作らない。旧公開先OpenAI Sites向けのファイル（`.openai/`、`worker/`、`vite.config.ts`）は移行完了まで残している。
- `data/cities.ts`（50都市・静的・出典付き）、`data/currencies.ts`（保存参考為替）
- `lib/scoring/life-atlas-score.ts`（財務45・暮らし20・優先軸25・信頼度10、決定的な順位）
- `lib/calculations/what-if.ts`、`break-even.ts`（What-Ifの条件変更は `buildWhatIfChanges` を画面とAIで共用）
- `lib/billing/entitlements.ts` に権限判定を集約。プラン名の判定をUIへ散らさない。Pro機能はAPI側でも確認する。
- Supabaseは `lib/supabase-server.ts` からRESTで利用。RLSを緩めない。service roleキーはサーバー専用。
- 主要UIは `app/page.tsx` と `components/offer-analyzer/offer-analyzer.tsx`（大きいが、全面リファクタリングはしない。必要な範囲だけ抽出する）。

## デザイン原則（研究機関のレポート型）
- 紙のような背景・細い罫線・控えめなアクセント（深緑）・見出しは明朝／セリフ、数値は等幅数字。写真・グラデーション・強い影・大きな角丸は使わない。
- 最初に見せるのは雰囲気ではなく「結論・主要指標・出典」。数値はカタログから計算し、手入力の宣伝用数字を載せない。
- 既定はライトテーマ。ダークテーマは同じ構成で色だけを切り替える。テーマの色は `app/globals.css` 末尾の Research theme の変数で管理する。

## コマンド
```bash
npm run test:unit   # unitテスト（node --test、型ストリップ）
npx tsc --noEmit
npm run lint
npm test            # unit + next build + 描画後HTMLテスト（重いので重複実行しない）
git diff --check
```
UI変更はビルド成功だけで完了扱いにせず、実際の描画（日英・ダーク/ライト・390pxと1280px・横スクロールなし）を確認する。

## 運用ルール
- 秘密値（Supabase service role、AI Gateway、Stripe、`LIFEATLAS_DIAGNOSTICS_TOKEN`）を出力・ログ・Gitへ出さない。`NEXT_PUBLIC_` を付けない。
- `main` へのマージ（＝Vercel本番デプロイ）、Supabaseスキーマ・Auth変更、Stripeの商品・Webhook作成、live課金は、実行直前にユーザーの承認を得る。
- force push・履歴の書き換え・ユーザーデータ削除はしない。
- 本番設定は `GET /api/operations/diagnostics?probe=1`（Bearerトークン必須）で確認し、推測で「設定済み」と言わない。
- 新しい依存は既存スタックで代替できない場合だけ追加する。

## 運用体制（オーナーは監督役）
オーナーは作業者ではなく監督役（ストッパー）です。実装・検証・PR作成・CI対応・マージ・本番確認はClaudeが自律的に進め、オーナーには結果だけを短く報告します。
- 次の操作だけは、実行前に内容と影響を1〜2行で示し、オーナーの「はい」を得る：
  - 実際のお金が動く操作（Stripe live、AI Gatewayの有料利用開始・カード登録、ドメイン購入）
  - データの削除、Supabaseのスキーマ・RLSの変更、アカウントのセキュリティ設定の変更
  - お客様データ（テーブルの中身）の閲覧・出力
  - 公開範囲・ドメインの変更
- オーナーが「止めて」「ストップ」と言ったら、進行中の作業を直ちに止め、状態を報告する。
- 緊急停止の手段：環境変数の `VERCEL_TOKEN`・`SUPABASE_ACCESS_TOKEN`・`STRIPE_TEST_SECRET_KEY` を各サービスで無効化すれば、Claudeは外部サービスを操作できなくなる。
- 本人確認・2FA・トークン発行など、オーナー本人にしかできない操作は、手順を最小のクリック数で案内する。回避や代行はしない。
- 報告は専門用語を避け、「何が動くようになったか」「オーナーの判断が必要なこと」を先に書く。
