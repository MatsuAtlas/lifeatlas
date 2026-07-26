import "./globals.css";

export const metadata = {
  title: "Life Atlas | 収入と都市の比較 / Income & city comparison",
  description: "税金、家賃、生活費、購買力をもとに、世界の都市での暮らしを比較します。 Compare income, taxes, rent, living costs and purchasing power across cities.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
