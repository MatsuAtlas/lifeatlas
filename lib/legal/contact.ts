// プライバシーポリシー等に載せる問い合わせ先。秘密値ではありませんが、オーナーが決めるまでは未設定のままにし、
// 推測したアドレスを表示しないようにします。
const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export function publicContactEmail(env: Record<string, string | undefined> = process.env) {
  const value = env.LIFEATLAS_CONTACT_EMAIL?.trim();
  return value && EMAIL_PATTERN.test(value) && value.length <= 254 ? value : null;
}
