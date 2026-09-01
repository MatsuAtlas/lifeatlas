import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = new URL("/og.png", `${protocol}://${host}`).toString();
  const title = "Life Atlas | 暮らしとビジネスで、世界の都市を選ぶ";
  const description = "税金、家賃、生活費、購買力とビジネス環境を世界の都市で比較。注目10都市は公式情報源から法人設立・外国人要件・税制を整理します。";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title,
    description,
    icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
    openGraph: { title, description, type: "website", images: [{ url: imageUrl, width: 1200, height: 630, alt: "Life Atlas — 暮らしとビジネスで、世界の都市を選ぶ" }] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
