"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { trackProductEvent, trackProductEventOnce } from "../../lib/analytics/client";
import { PUBLIC_BILLING_PLANS } from "../../lib/billing/plans";
import type { BillingInterval } from "../../types/billing";

type Language = "ja" | "en";
type AuthState = "loading" | "signed-out" | "signed-in";

const copy = {
  ja: {
    switchLanguage: "English",
    back: "← LifeAtlasへ戻る",
    eyebrow: "LIFEATLAS PRICING",
    title: "大きな意思決定を、数字で確かめる。",
    intro: "基本比較は無料。複数オファーのWhat-If、逆転給与、長期資産、共有まで必要になったらProへ。",
    free: "Free",
    pro: "Pro",
    current: "現在の基本プラン",
    freePrice: "$0",
    month: "月額",
    year: "年額",
    annualSaving: "月額換算で約45%お得",
    chooseMonth: "月額Proを選ぶ",
    chooseYear: "年額Proを選ぶ",
    login: "アップグレードにはログインが必要です。",
    loginLink: "ログインへ",
    preparing: "Stripe Checkoutへ接続中…",
    stripeNote: "支払い情報はLifeAtlasに保存せず、Stripeの安全な購入画面で処理します。いつでも契約管理画面から変更・解約できます。",
    canceled: "購入は行われませんでした。プランは変更されていません。",
    error: "購入画面を開始できませんでした。時間をおいて再度お試しください。",
    freeFeatures: ["世界50都市の基本比較", "2シナリオまで", "限定AI説明", "保存1件"],
    proFeatures: ["最大5シナリオ", "What-Ifと逆転給与", "5年・10年資産とFIRE", "AI説明と追質問", "保存・共有・ダウンロード", "家族・カスタム条件"],
  },
  en: {
    switchLanguage: "日本語",
    back: "← Back to LifeAtlas",
    eyebrow: "LIFEATLAS PRICING",
    title: "Validate a major decision with numbers.",
    intro: "Core comparison stays free. Upgrade when you need multi-offer What-If, break-even salary, long-term wealth and sharing.",
    free: "Free",
    pro: "Pro",
    current: "Current base plan",
    freePrice: "$0",
    month: "Monthly",
    year: "Annual",
    annualSaving: "About 45% less per month",
    chooseMonth: "Choose monthly Pro",
    chooseYear: "Choose annual Pro",
    login: "Sign in before upgrading.",
    loginLink: "Go to sign in",
    preparing: "Connecting to Stripe Checkout…",
    stripeNote: "LifeAtlas never stores payment details. Stripe processes them on its secure checkout, and you can change or cancel from the billing portal.",
    canceled: "No purchase was made. Your plan has not changed.",
    error: "Checkout could not be started. Please try again shortly.",
    freeFeatures: ["Basic comparison across 50 cities", "Up to 2 scenarios", "Limited AI explanations", "1 saved analysis"],
    proFeatures: ["Up to 5 scenarios", "What-If and break-even salary", "5/10-year wealth and FIRE", "AI explanations and follow-ups", "Save, share and download", "Family and custom assumptions"],
  },
} as const;

export function PricingClient({ canceled = false }: { canceled?: boolean }) {
  const [language, setLanguage] = useState<Language>("ja");
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [loadingInterval, setLoadingInterval] = useState<BillingInterval | null>(null);
  const [message, setMessage] = useState("");
  const t = copy[language];

  useEffect(() => {
    trackProductEventOnce("pricing_viewed");
    let active = true;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (active) setAuthState(response.ok ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (active) setAuthState("signed-out");
      });
    return () => { active = false; };
  }, []);

  async function startCheckout(interval: BillingInterval) {
    trackProductEvent("upgrade_clicked", { interval });
    setMessage("");
    setLoadingInterval(interval);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data: unknown = await response.json();
      const url = data && typeof data === "object" && !Array.isArray(data) ? (data as { url?: unknown }).url : null;
      if (!response.ok || typeof url !== "string" || !url.startsWith("https://checkout.stripe.com/")) throw new Error("CHECKOUT_FAILED");
      window.location.assign(url);
    } catch {
      setMessage(t.error);
      setLoadingInterval(null);
    }
  }

  return (
    <main className="billing-page">
      <header className="billing-header">
        <Link href="/">✦ Life Atlas</Link>
        <div><Link href="/analyze">Offer Analyzer</Link><Link href="/account">Account</Link><button type="button" onClick={() => setLanguage((value) => value === "ja" ? "en" : "ja")}>{t.switchLanguage}</button></div>
      </header>
      <section className="billing-hero">
        <Link href="/" className="billing-back">{t.back}</Link>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        {canceled && <p className="billing-notice" role="status">{t.canceled}</p>}
      </section>
      <section className="pricing-grid" aria-label="LifeAtlas plans">
        <article className="pricing-card">
          <span>{t.current}</span>
          <h2>{t.free}</h2>
          <strong>{t.freePrice}</strong>
          <ul>{t.freeFeatures.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
          <Link className="secondary-button" href="/analyze">Offer Analyzer</Link>
        </article>
        <article className="pricing-card pricing-card-pro">
          <span>RECOMMENDED</span>
          <h2>{t.pro}</h2>
          <div className="pricing-options">
            <div><small>{t.month}</small><strong>{PUBLIC_BILLING_PLANS.month.label}</strong><button className="primary-button" type="button" onClick={() => void startCheckout("month")} disabled={authState !== "signed-in" || loadingInterval !== null}>{loadingInterval === "month" ? t.preparing : t.chooseMonth}</button></div>
            <div><small>{t.year}</small><strong>{PUBLIC_BILLING_PLANS.year.label}</strong><em>{t.annualSaving}</em><button className="primary-button" type="button" onClick={() => void startCheckout("year")} disabled={authState !== "signed-in" || loadingInterval !== null}>{loadingInterval === "year" ? t.preparing : t.chooseYear}</button></div>
          </div>
          {authState === "signed-out" && <p className="billing-signin">{t.login} <Link href="/#account">{t.loginLink} →</Link></p>}
          {message && <p className="billing-error" role="alert">{message}</p>}
          <ul>{t.proFeatures.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
        </article>
      </section>
      <p className="billing-stripe-note">{t.stripeNote}</p>
    </main>
  );
}
