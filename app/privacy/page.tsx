import type { Metadata } from "next";
import Link from "next/link";

import { contactForDisplay } from "../../lib/legal/contact";

export const metadata: Metadata = {
  title: "Privacy policy | Life Atlas",
  description: "LifeAtlasが取得する情報、利用目的、委託先、保存期間、削除の方法を説明します。",
};

// 実装に合わせて記載しています。保存する項目や委託先を変えたら、このページも同時に更新してください。
const REVISED_ON = { ja: "2026年9月29日", en: "29 September 2026" };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const en = lang === "en";
  const contact = contactForDisplay();
  const provisionalNote = en ? " (provisional — it will be replaced with the official address before LifeAtlas opens to the public)" : "（仮。一般公開までに正式なアドレスへ差し替えます）";

  const sections: Array<[string, string[]]> = en ? [
    ["1. Operator", ["LifeAtlas is operated by the LifeAtlas operator (an individual). The operator's name and address will be disclosed without delay on request."]],
    ["2. Information we collect", [
      "Account: your email address (passwords are stored hashed by Supabase, never in plain text). If you sign in with Google, we receive the basic profile Google shares, such as your email address, name, profile picture URL and account identifier.",
      "Saved comparisons: the cities, salary amounts, household, housing and lifestyle settings, your spouse's salary and your children's ages if you enter them, whether you chose a newcomer tax regime (such as the Dutch 30% ruling or Korea's 19% flat rate for foreign workers), and results you choose to save. The number of people eligible for Japan's disability deduction is used only on your screen to show a separate figure; it is not saved, shared or sent to our servers or the AI.",
      "Profile: age, household type, number of children, base currency, current city and priorities you enter.",
      "AI explanations: the structured calculation results and any follow-up question you type. Your email address is not sent to the AI model.",
      "Billing: Stripe customer ID, subscription status, plan and renewal date. Card numbers are entered on Stripe's page and are never stored by LifeAtlas.",
      "Usage: a random device ID, the page path and the type of button pressed (for example, 'share clicked'). We do not record what you type into calculators.",
    ]],
    ["3. How we use it", ["To provide comparisons, saving, sharing and AI explanations; to manage subscriptions; to prevent abuse; and to improve the product using aggregated usage."]],
    ["4. Service providers", [
      "Supabase (account sign-in and database), Stripe (payments), Vercel (hosting and the AI Gateway that relays AI explanations to the AI model provider).",
      "These providers may process data on servers outside your country, including in the United States. We use them only to run LifeAtlas and do not sell personal information.",
    ]],
    ["5. Cookies and device storage", ["Sign-in cookies (HTTP-only) keep you logged in. Your browser also stores comparisons you save on this device and the random usage ID. You can delete them from your browser at any time."]],
    ["6. Public share links", ["If you create a share link, anyone with the link can see the cities, salaries and results in that snapshot. Your name and email address are not included."]],
    ["7. Retention and deletion", [
      "You can delete saved comparisons one by one, or delete your whole account from the Account page. Deleting the account immediately removes your sign-in, saved comparisons, profile, AI explanation history, share links and subscription record, and cancels an active subscription (the remaining paid period is not refunded).",
      "Usage records are kept without your account link. Stripe keeps payment records as required by law.",
    ]],
    ["8. Security", ["All traffic is encrypted. Database rules allow each signed-in user to read only their own records, and server-only keys are never sent to the browser."]],
    ["9. Requests and contact", ["You may request disclosure, correction, suspension of use or deletion of your personal information."]],
  ] : [
    ["1. 事業者", ["LifeAtlasは、LifeAtlas運営者（個人）が運営しています。運営者の氏名・住所は、請求があれば遅滞なく開示します。"]],
    ["2. 取得する情報", [
      "アカウント：メールアドレス（パスワードはSupabaseが復元できない形に変換して保管し、そのままの形では保存しません）。Googleでログインした場合は、メールアドレス・氏名・プロフィール画像のURL・アカウントの識別子など、Googleから提供される基本情報。",
      "保存した比較：保存を選んだ都市、給与額、世帯・住居・生活スタイルの条件、入力した場合は配偶者の給与年収と子どもの年齢、移住者向けの税の特例（オランダの30%ルール、韓国の外国人勤労者の単一税率など）を選んだかどうか、計算結果。日本の障害者控除の対象人数は、画面の中で別の金額を示すためだけに使い、保存・共有せず、サーバーやAIにも送りません。",
      "プロフィール：入力した年齢、世帯、子どもの人数、基準通貨、現在の都市、優先軸。",
      "AIによる説明：計算済みの結果と、入力した追加の質問文。メールアドレスはAIに送りません。",
      "課金：Stripeの顧客ID、契約状態、プラン、更新日。カード番号はStripeの画面で入力され、LifeAtlasでは一切保存しません。",
      "利用状況：端末ごとのランダムなID、表示したページ、押したボタンの種類（例：「共有を押した」）。計算画面に入力した内容は記録しません。",
    ]],
    ["3. 利用目的", ["比較・保存・共有・AIによる説明の提供、定期課金の管理、不正利用の防止、集計した利用状況によるサービス改善のために利用します。"]],
    ["4. 委託先", [
      "Supabase（ログインとデータベース）、Stripe（決済）、Vercel（ホスティング、およびAIによる説明をAIモデルの提供元へ中継するAI Gateway）。",
      "これらの事業者は、米国を含む日本国外のサーバーで情報を処理することがあります。LifeAtlasの運営のためにのみ利用し、個人情報を販売しません。",
    ]],
    ["5. Cookieと端末内の保存", ["ログインを保つためのCookie（ブラウザのスクリプトから読めない設定）を使います。また、この端末に保存した比較とランダムな利用状況IDをブラウザ内に保存します。ブラウザの設定からいつでも削除できます。"]],
    ["6. 公開共有リンク", ["共有リンクを作ると、リンクを知っている人は誰でも、その時点の都市・給与・計算結果を見られます。氏名やメールアドレスは含まれません。"]],
    ["7. 保存期間と削除", [
      "保存した比較は1件ずつ削除できます。アカウントページからアカウント全体を削除することもでき、削除するとログイン情報、保存した比較、プロフィール、AIによる説明の履歴、共有リンク、契約情報をすぐに消去し、有効な定期課金は解約されます（支払い済みの残り期間分の返金はありません）。",
      "利用状況の記録は、アカウントとの結び付きを外して保持します。決済の記録は、法令に基づきStripeが保管します。",
    ]],
    ["8. 安全管理", ["通信はすべて暗号化しています。データベースは、ログインした本人が自分の記録だけを読める設定にしています。サーバー専用の鍵はブラウザへ送りません。"]],
    ["9. 開示等の請求・お問い合わせ", ["個人情報の開示、訂正、利用停止、削除を請求できます。"]],
  ];

  return <main className="growth-page reference-page">
    <header className="growth-header"><Link href="/">✦ Life Atlas</Link><nav><Link href="/analyze">Analyzer</Link><Link href={en ? "/privacy" : "/privacy?lang=en"}>{en ? "日本語" : "English"}</Link></nav></header>
    <section className="growth-hero reference-hero"><p className="eyebrow">PRIVACY POLICY</p><h1>{en ? "Privacy policy" : "プライバシーポリシー"}</h1><p>{en ? "What LifeAtlas stores, why, who processes it, and how to delete it." : "LifeAtlasが保存する情報、その理由、処理する事業者、削除の方法を説明します。"}</p></section>
    <section className="growth-section reference-section">
      {sections.map(([title, paragraphs]) => <article className="growth-panel privacy-section" key={title}><h2>{title}</h2>{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article>)}
      <article className="growth-panel privacy-section"><h2>{en ? "Contact" : "お問い合わせ先"}</h2><p>{contact.provisional ? `${contact.email}${provisionalNote}` : <a href={`mailto:${contact.email}`}>{contact.email}</a>}</p></article>
      <p className="growth-updated">{en ? "Last revised" : "最終改定日"}: {en ? REVISED_ON.en : REVISED_ON.ja}</p>
    </section>
  </main>;
}
