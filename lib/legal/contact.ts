// プライバシーポリシー・特定商取引法の表記に載せる問い合わせ先。
// オーナーが正式なアドレスを作るまでは、実在しない予約ドメイン（.example）の仮アドレスを「仮」と明示して表示します。
// 実在しうるアドレスを推測で載せると、他人に問い合わせが届くおそれがあるためです。
const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export const PROVISIONAL_CONTACT_EMAIL = "contact@lifeatlas.example";

export function publicContactEmail(env: Record<string, string | undefined> = process.env) {
  const value = env.LIFEATLAS_CONTACT_EMAIL?.trim();
  return value && EMAIL_PATTERN.test(value) && value.length <= 254 ? value : null;
}

export function contactForDisplay(env: Record<string, string | undefined> = process.env) {
  const email = publicContactEmail(env);
  return email ? { email, provisional: false } : { email: PROVISIONAL_CONTACT_EMAIL, provisional: true };
}
