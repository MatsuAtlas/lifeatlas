import type { Metadata } from "next";

import { SavedAnalysesClient } from "../../components/dashboard/saved-analyses-client";

export const metadata: Metadata = {
  title: "Dashboard | Life Atlas",
  description: "LifeAtlasで保存した非公開の意思決定分析を管理します。",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <SavedAnalysesClient />;
}
