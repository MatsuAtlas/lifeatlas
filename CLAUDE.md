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
- Next.js 16 App Router + React 19 + TypeScript。本番はVinext/Cloudflare Worker形式でOpenAI Sitesへ公開（`.openai/hosting.json`）。`vercel.json` は `git.deploymentEnabled: false` でVercelの自動デプロイを止めている（VercelはAI Gatewayでのみ使用）。
- `data/cities.ts`（50都市・静的・出典付き）、`data/currencies.ts`（保存参考為替）
- `lib/scoring/life-atlas-score.ts`（財務45・暮らし20・優先軸25・信頼度10、決定的な順位）
- `lib/calculations/what-if.ts`、`break-even.ts`（What-Ifの条件変更は `buildWhatIfChanges` を画面とAIで共用）
- `lib/billing/entitlements.ts` に権限判定を集約。プラン名の判定をUIへ散らさない。Pro機能はAPI側でも確認する。
- Supabaseは `lib/supabase-server.ts` からRESTで利用。RLSを緩めない。service roleキーはサーバー専用。
- 主要UIは `app/page.tsx` と `components/offer-analyzer/offer-analyzer.tsx`（大きいが、全面リファクタリングはしない。必要な範囲だけ抽出する）。

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
- GitHub push、Sitesデプロイ、Supabaseスキーマ・Auth変更、Stripeの商品・Webhook作成、live課金は、実行直前にユーザーの承認を得る。
- force push・履歴の書き換え・ユーザーデータ削除はしない。
- 本番設定は `GET /api/operations/diagnostics?probe=1`（Bearerトークン必須）で確認し、推測で「設定済み」と言わない。
- 新しい依存は既存スタックで代替できない場合だけ追加する。
