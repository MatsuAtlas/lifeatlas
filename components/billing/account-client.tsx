"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cities, cityOrder } from "../../data/cities";
import { FALLBACK_FX_TO_JPY } from "../../data/currencies";
import { DEFAULT_USER_PROFILE, isUserProfile } from "../../lib/user-profile";
import type { BillingStatusResponse } from "../../types/billing";
import type { CurrencyCode } from "../../types/city";
import type { UserProfile } from "../../types/profile";
import type { PriorityKey } from "../../types/scenario";

type User = { id: string; email?: string };
const currencyCodes = Object.keys(FALLBACK_FX_TO_JPY) as CurrencyCode[];
const priorityOrder: PriorityKey[] = ["savings", "purchasingPower", "qualityOfLife", "career", "entrepreneurship", "fire", "family", "safety", "climate", "remoteWork"];
const priorityLabels: Record<PriorityKey, { ja: string; en: string }> = {
  savings: { ja: "貯蓄", en: "Savings" }, purchasingPower: { ja: "購買力", en: "Purchasing power" }, qualityOfLife: { ja: "暮らしやすさ", en: "Quality of life" },
  career: { ja: "キャリア", en: "Career" }, entrepreneurship: { ja: "起業環境", en: "Entrepreneurship" }, fire: { ja: "FIRE", en: "FIRE" },
  family: { ja: "家族", en: "Family" }, safety: { ja: "安全性", en: "Safety" }, climate: { ja: "気候", en: "Climate" }, remoteWork: { ja: "リモート", en: "Remote work" },
};

export function AccountClient({ checkoutReturned = false }: { checkoutReturned?: boolean }) {
  const [language, setLanguage] = useState<"ja" | "en">("ja");
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ ...DEFAULT_USER_PROFILE, priorities: { ...DEFAULT_USER_PROFILE.priorities } });
  const [profileSaving, setProfileSaving] = useState(false);
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
        const [billingResponse, profileResponse] = await Promise.all([
          fetch("/api/billing/status", { cache: "no-store" }),
          fetch("/api/profile", { cache: "no-store" }),
        ]);
        const [billingData, profileData]: unknown[] = await Promise.all([
          billingResponse.json().catch(() => null),
          profileResponse.json().catch(() => null),
        ]);
        if (active && billingResponse.ok) setBilling(billingData as BillingStatusResponse);
        const savedProfile = profileData && typeof profileData === "object" ? (profileData as { profile?: unknown }).profile : null;
        if (active && profileResponse.ok && isUserProfile(savedProfile)) setProfile(savedProfile);
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

  async function saveProfile() {
    setMessage("");
    setProfileSaving(true);
    try {
      const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data: unknown = await response.json().catch(() => null);
      const savedProfile = data && typeof data === "object" ? (data as { profile?: unknown }).profile : null;
      if (!response.ok || !isUserProfile(savedProfile)) throw new Error("PROFILE_FAILED");
      setProfile(savedProfile);
      setMessage(ja ? "プロフィールと優先軸を保存しました。" : "Profile and priorities saved.");
    } catch {
      setMessage(ja ? "プロフィールを保存できませんでした。" : "Profile could not be saved.");
    } finally {
      setProfileSaving(false);
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
          <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
            <div className="profile-form-heading"><div><p className="eyebrow">PROFILE DEFAULTS</p><h2>{ja ? "比較の初期条件" : "Comparison defaults"}</h2></div><p>{ja ? "Analyzerで明示的に適用できる既定値です。既存の分析を自動で上書きしません。" : "Defaults you can explicitly apply in the Analyzer. Existing analyses are never overwritten automatically."}</p></div>
            <div className="profile-form-grid">
              <label>{ja ? "年齢" : "Age"}<input type="number" min="18" max="100" value={profile.age} onChange={(event) => setProfile((current) => ({ ...current, age: Number(event.target.value) }))} /></label>
              <label>{ja ? "世帯" : "Household"}<select value={profile.householdType} onChange={(event) => setProfile((current) => ({ ...current, householdType: event.target.value as UserProfile["householdType"] }))}><option value="single">{ja ? "単身" : "Single"}</option><option value="couple">{ja ? "夫婦・パートナー" : "Couple"}</option></select></label>
              <label>{ja ? "子ども" : "Children"}<input type="number" min="0" max="10" value={profile.children} onChange={(event) => setProfile((current) => ({ ...current, children: Number(event.target.value) }))} /></label>
              <label>{ja ? "基準通貨" : "Base currency"}<select value={profile.baseCurrency} onChange={(event) => setProfile((current) => ({ ...current, baseCurrency: event.target.value as CurrencyCode }))}>{currencyCodes.map((currency) => <option value={currency} key={currency}>{currency}</option>)}</select></label>
              <label className="profile-city-field">{ja ? "現在都市" : "Current city"}<select value={profile.currentCity} onChange={(event) => setProfile((current) => ({ ...current, currentCity: event.target.value as UserProfile["currentCity"] }))}>{cityOrder.map((cityId) => <option value={cityId} key={cityId}>{ja ? cities[cityId].name : cities[cityId].englishName ?? cities[cityId].name}</option>)}</select></label>
            </div>
            <div className="profile-priority-grid">{priorityOrder.map((priority) => <label key={priority}><span>{priorityLabels[priority][language]}<strong>{profile.priorities[priority]}/5</strong></span><input type="range" min="0" max="5" step="1" value={profile.priorities[priority]} onChange={(event) => setProfile((current) => ({ ...current, priorities: { ...current.priorities, [priority]: Number(event.target.value) } }))} /></label>)}</div>
            <button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? (ja ? "保存中…" : "Saving…") : (ja ? "プロフィールを保存" : "Save profile")}</button>
          </form>
        </>}
      </section>
    </main>
  );
}
