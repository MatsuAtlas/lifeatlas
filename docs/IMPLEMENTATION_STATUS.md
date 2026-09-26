# 実装状況（2026-09-26時点）

「コードあり」と「本番で動作確認済み」を区別して記録します。状況が変わったら更新してください。

## 区分
| 機能 | コード | ローカル検証 | 本番確認 |
|---|---|---|---|
| 50都市比較・次に見るべき3都市（50都市対象、ビジネス参考値50%補正） | あり | 済（描画・入力保持・日英・390px） | 未 |
| Offer Analyzer（2〜5件、手取り・貯蓄・FIRE・資産予測） | あり | 済 | 未 |
| LifeAtlas Score・決定的順位・計算不能シナリオの35点上限 | あり | 済 | 未 |
| What-If・逆転給与（Pro） | あり | 済（`/api/break-even` はPro限定） | 未 |
| 共通為替（ECBスナップショット＋保存参考レート） | あり | unitテスト済（この環境からECBへ接続不可のためlive経路は未実機確認） | 未 |
| 認証（メール・Google OAuth）・保存・改名・複製・削除 | あり | 未（Supabase未設定） | 未 |
| Stripe Checkout・Webhook・Customer Portal | あり | 未 | 未 |
| AI説明（構造化出力・キャッシュ・日次上限） | あり | 未（AI Gateway未設定） | 未 |
| 公開共有・CSV・SEOページ・sitemap | あり | SEO/sitemapは済 | 未 |
| 本番設定診断 `GET /api/operations/diagnostics` | あり | 済（404・秘密値非表示） | 未 |
| LifeAtlas Decision Report（単発課金 $39〜49） | 予定のみ（`planned`） | — | — |

## データ範囲
- 全50都市。税・社会保険の金額計算が可能なのは25都市（official-scenario 2、official-rate-estimate 23）。残り25都市は未対応で、手取り・貯蓄は `—`。
- 信頼度：high 3 / medium 22 / low 25。保存参考値・推定値を含む都市は36。
- ビジネス詳細データは10都市、残り40都市は参考値。
- 都市データは静的（`data/cities.ts`）。鮮度判定は手入力の `updatedAt` に基づくため、値の再確認日とは限らない。
- 実行時に取得する外部データはECB為替とWorld Bankの国人口のみ。

## 既知の制約・技術的負債
- 税計算はどの国も単身扱い。配偶者・扶養控除、米国の夫婦合算申告、子ども手当は未反映（世帯は生活費倍率と一部の健康保険料にのみ影響）。
- FIRE目標は年間生活費×25（4%ルール）。取り崩し時の税・インフレは未考慮。
- What-Ifはブラウザ内計算のため、Pro制限は画面上の制御。逆転給与APIとAI説明はサーバー側で制限。
- `app/page.tsx` と `offer-analyzer.tsx` が巨大な単一コンポーネント。E2Eテストはない。
- 未使用の依存・定義：`drizzle-orm`、`drizzle-kit`、`react-loading-skeleton`、Worker内のD1定義（テンプレートの名残）。
- SEOページは静的生成のため保存参考為替を使用。

## 本番化の残作業
1. 作業ブランチを `main` へ反映し、Sitesへデプロイ（要承認）。
2. Sitesに `LIFEATLAS_DIAGNOSTICS_TOKEN` を登録し、`?probe=1` でSupabase・Stripe（test mode）・AI Gatewayの設定を確認。
3. 本番E2E：Googleログイン、保存系操作、Stripe testでのCheckout→Webhook→Pro反映→Portal→解約、AI初回生成とキャッシュ、共有、日英、390px。
