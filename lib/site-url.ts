const DEFAULT_SITE_URL = "https://life-atlas-global-2026.dreamy-gnat-5451.chatgpt.site";

function httpsOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

// 優先順位：明示設定（NEXT_PUBLIC_SITE_URL）→ Vercelの本番ドメイン → 旧Sites本番URL。
export function siteUrl(env: Record<string, string | undefined> = process.env) {
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return httpsOrigin(env.NEXT_PUBLIC_SITE_URL)
    ?? (vercelHost ? httpsOrigin(`https://${vercelHost}`) : null)
    ?? DEFAULT_SITE_URL;
}
