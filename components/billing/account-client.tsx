"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { BillingStatusResponse } from "../../types/billing";

type User = { id: string; email?: string };

export function AccountClient({ checkoutReturned = false }: { checkoutReturned?: boolean }) {
  const [language, setLanguage] = useState<"ja" | "en">("ja");
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const ja = language === "ja";

  useEffect(() => {
    let active = true;
    async function load() {
      const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const authData: unknown = await authResponse.json().catch(() => null);
      const nextUser = authResponse.ok && authData && typeof authData === "object" ? (authData as { user?: User }).user ?? null : null;
      if (!active) return;
      setUser(nextUser);
      if (nextUser) {
        const billingResponse = await fetch("/api/billing/status", { cache: "no-store" });
        const billingData: unknown = await billingResponse.json().catch(() => null);
        if (active && billingResponse.ok) setBilling(billingData as BillingStatusResponse);
      }
      if (active) setLoading(false);
    }
    void load().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function openPortal() {
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data: unknown = await response.json();
      const url = data && typeof data === "object" ? (data as { url?: unknown }).url : null;
      if (!response.ok || typeof url !== "string" || !url.startsWith("https://billing.stripe.com/")) throw new Error("PORTAL_FAILED");
      window.location.assign(url);
    } catch {
      setMessage(ja ? "契約管理画面を開始できませんでした。" : "The billing portal could not be opened.");
      setLoading(false);
    }
  }

  const periodEnd = billing?.subscription.currentPeriodEnd
    ? new Intl.DateTimeFormat(ja ? "ja-JP" : "en-US", { dateStyle: "medium" }).format(new Date(billing.subscription.currentPeriodEnd))
    : null;

  return (
    <main className="billing-page">
      <header className="billing-header"><Link href="/">✦ Life Atlas</Link><div><Link href="/analyze">Offer Analyzer</Link><Link href="/dashboard">Dashboard</Link><Link href="/pricing">Pricing</Link><button type="button" onClick={() => setLanguage((value) => value === "ja" ? "en" : "ja")}>{ja ? "English" : "日本語"}</button></div></header>
      <section className="billing-hero account-hero">
        <p className="eyebrow">LIFEATLAS ACCOUNT</p>
        <h1>{ja ? "アカウントと契約" : "Account and billing"}</h1>
        <p>{ja ? "保存した分析とPro契約を、同じアカウントで管理します。" : "Manage saved analyses and your Pro subscription in one account."}</p>
        {checkoutReturned && <p className="billing-notice" role="status">{ja ? "Stripeでの処理結果を確認中です。反映に数秒かかる場合があります。" : "Checking the Stripe result. Updates can take a few seconds."}</p>}
      </section>
      <section className="account-panel">
        {loading && <p>{ja ? "確認中…" : "Loading…"}</p>}
        {!loading && !user && <><h2>{ja ? "ログインが必要です" : "Sign in required"}</h2><p>{ja ? "LifeAtlasトップのアカウント欄からログインしてください。" : "Sign in from the account section on the LifeAtlas home page."}</p><Link className="primary-button" href="/#account">{ja ? "ログインへ" : "Go to sign in"}</Link></>}
        {!loading && user && <>
          <div className="account-row"><span>{ja ? "メール" : "Email"}</span><strong>{user.email ?? user.id}</strong></div>
          <div className="account-row"><span>{ja ? "プラン" : "Plan"}</span><strong>{billing?.subscription.tier === "pro" ? "LifeAtlas Pro" : "Free"}</strong></div>
          <div className="account-row"><span>{ja ? "契約状態" : "Status"}</span><strong>{billing?.subscription.status ?? (ja ? "未設定" : "Unavailable")}</strong></div>
          {periodEnd && <div className="account-row"><span>{billing?.subscription.cancelAtPeriodEnd ? (ja ? "利用終了予定" : "Access ends") : (ja ? "次回更新" : "Renews")}</span><strong>{periodEnd}</strong></div>}
          <div className="account-actions">
            {billing?.subscription.tier === "pro" ? <button className="primary-button" type="button" onClick={() => void openPortal()} disabled={loading}>{ja ? "契約を管理" : "Manage subscription"}</button> : <Link className="primary-button" href="/pricing">{ja ? "Proを見る" : "View Pro"}</Link>}
            <Link className="secondary-button" href="/analyze">Offer Analyzer</Link>
            <Link className="secondary-button" href="/dashboard">Dashboard</Link>
          </div>
          {message && <p className="billing-error" role="alert">{message}</p>}
        </>}
      </section>
    </main>
  );
}
