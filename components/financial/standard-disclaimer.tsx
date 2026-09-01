type DisclaimerLanguage = "ja" | "en";

const disclaimerCopy = {
  ja: {
    title: "重要な前提",
    body: "比較結果は公開情報と保存した参考値に基づく概算です。個別の控除、在留資格、雇用条件、医療保険等を完全には反映せず、税務・金融・移住助言ではありません。重要な判断では専門家と最新の公式情報をご確認ください。",
  },
  en: {
    title: "Important assumptions",
    body: "Results are estimates based on public sources and saved reference values. They do not fully reflect individual deductions, immigration status, employment terms or health coverage, and are not tax, financial or immigration advice. Confirm important decisions with professionals and current official sources.",
  },
} as const;

export function StandardDisclaimer({ language }: { language: DisclaimerLanguage }) {
  const copy = disclaimerCopy[language];
  return <aside className="oa-disclaimer" role="note"><strong>{copy.title}</strong><p>{copy.body}</p></aside>;
}
