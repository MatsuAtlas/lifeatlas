import type { Metadata } from "next";

import { OfferAnalyzer } from "../../../components/offer-analyzer/offer-analyzer";

export const metadata: Metadata = {
  title: "Saved analysis | Life Atlas",
  description: "保存した非公開のLifeAtlas分析を再開します。",
  robots: { index: false, follow: false },
};

export default async function SavedAnalyzePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfferAnalyzer initialRecordId={id} />;
}
