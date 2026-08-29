import type { Metadata } from "next";

import { OfferAnalyzer } from "../../components/offer-analyzer/offer-analyzer";

export const metadata: Metadata = {
  title: "Offer Analyzer | Life Atlas",
  description: "2〜5件の海外オファーを、税金・生活費・貯蓄・長期資産・LifeAtlas Scoreで比較します。",
};

export default function AnalyzePage() {
  return <OfferAnalyzer />;
}
