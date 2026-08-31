"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { trackProductEvent } from "../../lib/analytics/client";
import { isComparisonRecord, isSavedAnalyzerInput } from "../../lib/comparison-history";
import type { BillingStatusResponse } from "../../types/billing";
import type { ComparisonRecord } from "../../types/comparison";

type Language = "ja" | "en";
type User = { id: string; email?: string };

export function SavedAnalysesClient() {
  const [language, setLanguage] = useState<Language>("ja");
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [records, setRecords] = useState<ComparisonRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const ja = language === "ja";

  useEffect(() => {
    let active = true;
    async function load() {
    try {
      const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
      const authData: unknown = await authResponse.json().catch(() => null);
      const nextUser = authResponse.ok && authData && typeof authData === "object" ? (authData as { user?: User }).user ?? null : null;
      if (!active) return;
      setUser(nextUser);
      if (!nextUser) {
        setRecords([]);
        return;
      }
      const [historyResponse, billingResponse] = await Promise.all([
        fetch("/api/history", { cache: "no-store" }),
        fetch("/api/billing/status", { cache: "no-store" }),
      ]);
      const historyData: unknown = await historyResponse.json().catch(() => null);
      const billingData: unknown = await billingResponse.json().catch(() => null);
      if (!active) return;
      if (historyResponse.ok && historyData && typeof historyData === "object") {
        const history = (historyData as { history?: unknown }).history;
        setRecords(Array.isArray(history) ? history.filter(isComparisonRecord).filter((record) => isSavedAnalyzerInput(record.input)) : []);
      }
      if (billingResponse.ok) setBilling(billingData as BillingStatusResponse);
    } catch {
      if (active) setMessage("保存した分析を読み込めませんでした。 / Saved analyses could not be loaded.");
    } finally {
      if (active) setLoading(false);
    }
    }
    void load();
    return () => { active = false; };
  }, []);

  const isPro = billing?.subscription.tier === "pro";
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(ja ? "ja-JP" : "en-US", { dateStyle: "medium", timeStyle: "short" }), [ja]);

  async function rename(record: ComparisonRecord) {
    const title = draftTitle.trim();
    if (!title || title.length > 120) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/history?id=${encodeURIComponent(record.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      const data: unknown = await response.json().catch(() => null);
      const updated = data && typeof data === "object" ? (data as { record?: unknown }).record : null;
      if (!response.ok || !isComparisonRecord(updated)) throw new Error("RENAME_FAILED");
      setRecords((current) => current.map((item) => item.id === record.id ? updated : item));
      setEditingId(null);
      setMessage(ja ? "比較名を更新しました。" : "Comparison renamed.");
    } catch {
      setMessage(ja ? "比較名を更新できませんでした。" : "Comparison could not be renamed.");
    } finally {
      setLoading(false);
    }
  }

  async function duplicate(record: ComparisonRecord) {
    setLoading(true);
    try {
      const response = await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `${record.title}${ja ? "（複製）" : " (copy)"}`.slice(0, 120), origin_city: record.origin_city, destination_city: record.destination_city, input: record.input, result: record.result }) });
      const data: unknown = await response.json().catch(() => null);
      const created = data && typeof data === "object" ? (data as { record?: unknown }).record : null;
      if (!response.ok || !isComparisonRecord(created)) throw new Error("DUPLICATE_FAILED");
      setRecords((current) => [created, ...current]);
      setMessage(ja ? "分析を複製しました。" : "Analysis duplicated.");
    } catch {
      setMessage(ja ? "複製できませんでした。Freeプランでは保存上限が1件です。" : "Could not duplicate. Free is limited to one saved analysis.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(record: ComparisonRecord) {
    setLoading(true);
    try {
      const response = await fetch(`/api/history?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("DELETE_FAILED");
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setMessage(ja ? "分析を削除しました。" : "Analysis deleted.");
    } catch {
      setMessage(ja ? "削除できませんでした。" : "Analysis could not be deleted.");
    } finally {
      setLoading(false);
    }
  }

  async function share(record: ComparisonRecord) {
    if (!isSavedAnalyzerInput(record.input)) return;
    setLoading(true);
    trackProductEvent("share_clicked", { action: "dashboard" });
    try {
      const response = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: record.title, language, analysis: record.input }) });
      const data: unknown = await response.json().catch(() => null);
      const url = data && typeof data === "object" ? (data as { url?: unknown }).url : null;
      if (!response.ok || typeof url !== "string") throw new Error("SHARE_FAILED");
      await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
      setMessage(ja ? "公開リンクをコピーしました。" : "Public link copied.");
    } catch {
      setMessage(ja ? "共有リンクを作成できませんでした。共有はPro限定です。" : "Could not create a share link. Sharing requires Pro.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="billing-page dashboard-page">
    <header className="billing-header"><Link href="/">✦ Life Atlas</Link><div><Link href="/analyze">Offer Analyzer</Link><Link href="/account">Account</Link><button type="button" onClick={() => setLanguage((value) => value === "ja" ? "en" : "ja")}>{ja ? "English" : "日本語"}</button></div></header>
    <section className="billing-hero account-hero"><p className="eyebrow">LIFEATLAS DASHBOARD</p><h1>{ja ? "保存した意思決定" : "Saved decisions"}</h1><p>{ja ? "分析の再開、名前変更、複製、削除、公開共有をここで管理します。" : "Resume, rename, duplicate, delete and optionally share your analyses."}</p></section>
    <section className="account-panel dashboard-panel">
      {loading && records.length === 0 && <p>{ja ? "読み込み中…" : "Loading…"}</p>}
      {!loading && !user && <><h2>{ja ? "ログインが必要です" : "Sign in required"}</h2><p>{ja ? "保存済み分析は本人のアカウントだけから取得できます。" : "Saved analyses are available only to their owner."}</p><Link className="primary-button" href="/#account">{ja ? "ログインへ" : "Go to sign in"}</Link></>}
      {user && <>
        <div className="dashboard-summary"><div><span>{ja ? "保存件数" : "Saved"}</span><strong>{records.length}</strong></div><div><span>{ja ? "プラン" : "Plan"}</span><strong>{isPro ? "LifeAtlas Pro" : "Free"}</strong></div><Link className="primary-button" href="/analyze">＋ {ja ? "新しい分析" : "New analysis"}</Link></div>
        {message && <p className="billing-notice" role="status">{message}</p>}
        <div className="dashboard-list">{records.length === 0 ? <p>{ja ? "保存したOffer Analyzer分析はまだありません。" : "No saved Offer Analyzer analyses yet."}</p> : records.map((record) => <article className="dashboard-item" key={record.id}>
          <div className="dashboard-item-copy">{editingId === record.id ? <div className="dashboard-rename"><input value={draftTitle} maxLength={120} onChange={(event) => setDraftTitle(event.target.value)} /><button type="button" onClick={() => void rename(record)} disabled={loading}>{ja ? "保存" : "Save"}</button><button type="button" onClick={() => setEditingId(null)}>{ja ? "取消" : "Cancel"}</button></div> : <><h2>{record.title}</h2><p>{record.origin_city} → {record.destination_city}</p><small>{dateFormatter.format(new Date(record.updated_at ?? record.created_at))}</small></>}</div>
          <div className="dashboard-item-actions"><Link className="primary-button" href={`/analyze/${record.id}`}>{ja ? "分析を開く" : "Open"}</Link><button className="secondary-button" type="button" onClick={() => { setEditingId(record.id); setDraftTitle(record.title); }}>{ja ? "名前変更" : "Rename"}</button><button className="secondary-button" type="button" onClick={() => void duplicate(record)} disabled={loading}>{ja ? "複製" : "Duplicate"}</button>{isPro && <button className="secondary-button" type="button" onClick={() => void share(record)} disabled={loading}>{ja ? "共有" : "Share"}</button>}<button className="text-button" type="button" onClick={() => void remove(record)} disabled={loading}>{ja ? "削除" : "Delete"}</button></div>
        </article>)}</div>
      </>}
    </section>
  </main>;
}
