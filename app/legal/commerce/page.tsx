import type { Metadata } from "next";
import Link from "next/link";

import { PUBLIC_BILLING_PLANS } from "../../../lib/billing/plans";
import { contactForDisplay } from "../../../lib/legal/contact";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | Life Atlas",
  description: "LifeAtlas Proの販売条件（価格、支払方法、提供時期、解約）を表示します。",
};

// 価格は課金プランの定義（lib/billing/plans.ts）から表示し、手入力しません。
// 氏名・住所・電話番号は、特定商取引法施行規則に基づき「請求があれば遅滞なく提供する」旨の表示で省略しています。
export default async function CommerceDisclosurePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const en = lang === "en";
  const contact = contactForDisplay();
  const onRequest = en ? "Disclosed without delay upon request to the contact address below." : "請求があれば遅滞なく開示します（下記のお問い合わせ先へご連絡ください）。";
  const contactValue = contact.provisional
    ? `${contact.email}${en ? " (provisional — replaced with the official address before public launch)" : "（仮。一般公開までに正式なアドレスへ差し替えます）"}`
    : contact.email;
  const month = PUBLIC_BILLING_PLANS.month.amountUsd;
  const year = PUBLIC_BILLING_PLANS.year.amountUsd;

  const rows: Array<[string, string]> = en ? [
    ["Seller", `LifeAtlas operator (individual). ${onRequest}`],
    ["Person responsible", onRequest],
    ["Address", onRequest],
    ["Phone", onRequest],
    ["Email", contactValue],
    ["Price", `LifeAtlas Pro: US$${month} per month, or US$${year} per year. This is the total amount charged; no consumption tax or other tax is added on top.`],
    ["Other charges", "Internet connection fees. Your card issuer may add foreign-currency or conversion fees."],
    ["Payment method", "Credit or debit card and other methods offered on Stripe's checkout page."],
    ["When you pay", "At sign-up, then automatically at the start of each monthly or yearly period."],
    ["When the service starts", "Immediately after payment is completed."],
    ["Cancellation", "Cancel any time from Account → Manage subscription. Pro stays available until the end of the paid period, and no further charges are made. Deleting your account ends the subscription immediately."],
    ["Refunds", "Because the service is delivered digitally and immediately, fees already paid are not refunded pro rata, except where required by law."],
    ["System requirements", "A current version of Chrome, Safari, Edge or Firefox."],
  ] : [
    ["販売業者", `LifeAtlas運営者（個人）。氏名は${onRequest}`],
    ["運営統括責任者", onRequest],
    ["所在地", onRequest],
    ["電話番号", onRequest],
    ["メールアドレス", contactValue],
    ["販売価格", `LifeAtlas Pro：月額 US$${month}、または年額 US$${year}。表示価格がお支払いいただく総額で、消費税などを別途加算することはありません。`],
    ["商品代金以外の必要料金", "インターネット接続料金。カード会社が外貨取扱手数料などを加算する場合があります。"],
    ["支払方法", "クレジットカード・デビットカードなど、Stripeの購入画面に表示される方法。"],
    ["支払時期", "申込時にお支払いいただき、以後は月額または年額の各期間の開始時に自動で更新されます。"],
    ["提供時期", "決済の完了後、すぐにご利用いただけます。"],
    ["解約", "アカウントページの「契約を管理」から、いつでも解約できます。支払い済みの期間の終わりまでProを利用でき、以後の請求はありません。アカウントを削除した場合は、その時点で契約も終了します。"],
    ["返金", "デジタルサービスとしてすぐに提供されるため、支払い済みの料金の日割り返金は行いません（法令で必要な場合を除きます）。"],
    ["動作環境", "最新版のChrome、Safari、Edge、Firefox。"],
  ];

  return <main className="growth-page reference-page">
    <header className="growth-header"><Link href="/">✦ Life Atlas</Link><nav><Link href="/pricing">Pricing</Link><Link href={en ? "/legal/commerce" : "/legal/commerce?lang=en"}>{en ? "日本語" : "English"}</Link></nav></header>
    <section className="growth-hero reference-hero"><p className="eyebrow">LEGAL NOTICE</p><h1>{en ? "Commercial disclosure" : "特定商取引法に基づく表記"}</h1><p>{en ? "Sales terms for LifeAtlas Pro under Japan's Act on Specified Commercial Transactions." : "LifeAtlas Proの販売条件です。"}</p></section>
    <section className="growth-section reference-section">
      <article className="growth-panel"><dl className="growth-detail-list commerce-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === (en ? "Email" : "メールアドレス") && !contact.provisional ? <a href={`mailto:${contact.email}`}>{value}</a> : value}</dd></div>)}</dl></article>
      <p className="growth-updated"><Link href={`/privacy${en ? "?lang=en" : ""}`}>{en ? "Privacy policy" : "プライバシーポリシー"}</Link></p>
    </section>
  </main>;
}
