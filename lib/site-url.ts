const DEFAULT_SITE_URL = "https://life-atlas-global-2026.dreamy-gnat-5451.chatgpt.site";

export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return DEFAULT_SITE_URL;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:") return DEFAULT_SITE_URL;
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SITE_URL;
  }
}
