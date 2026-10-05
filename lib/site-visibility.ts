// 一般公開の前は、URLを知っている人には表示できても、検索エンジンには載せません。
// オーナーが一般公開を決めたら、Vercelの環境変数 LIFEATLAS_PUBLIC_LAUNCH=true を設定します。
export function isPublicLaunch(env: Record<string, string | undefined> = process.env) {
  return env.LIFEATLAS_PUBLIC_LAUNCH?.trim() === "true";
}

const PRIVATE_PATHS = ["/account", "/dashboard", "/analyze/", "/api/"];

export function robotsRules(env: Record<string, string | undefined> = process.env) {
  return isPublicLaunch(env)
    ? { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }
    : { userAgent: "*", disallow: ["/", ...PRIVATE_PATHS] };
}
