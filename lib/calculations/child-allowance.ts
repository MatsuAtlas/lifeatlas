import type { ChildAllowance } from "../../types/scenario";

// 日本の児童手当（2024年10月以降の制度。所得制限なし）。こども家庭庁「児童手当制度のご案内」の月額：
// 3歳未満15,000円、3歳以上高校生年代まで10,000円、第3子以降はどちらも30,000円。
// 「第3子以降」は、児童と22歳到達後の最初の3月31日までの兄姉のうち、年上から数えて3人目以降です。
// 入力の年齢は12月31日時点なので、その時点の月額を示します（年の途中の誕生日・出生による月ごとの変化は計算しません）。
// 19〜22歳の兄姉は親が生活費を負担している前提で数えます。手取り・スコアには含めません（他国の手当が未対応のため）。
export const JAPAN_CHILD_ALLOWANCE_SOURCE = { name: "こども家庭庁・児童手当制度のご案内", url: "https://www.cfa.go.jp/policies/kokoseido/jidouteate/annai", period: "2024年10月以降" };

export function japanChildAllowanceMonthly(childrenAges: number[]): number {
  // 12月31日時点で18歳なら、18歳到達後の最初の3月31日（翌年3月）までなので支給対象です。22歳なら兄姉として数えます。
  const counted = childrenAges.filter((age) => age <= 22).sort((a, b) => b - a);
  return counted.reduce((total, age, index) => {
    if (age > 18) return total;
    return total + (index >= 2 ? 30_000 : age < 3 ? 15_000 : 10_000);
  }, 0);
}

export function japanChildAllowance(childrenAges: number[] | undefined): ChildAllowance | null {
  if (!childrenAges || childrenAges.length === 0) return null;
  const monthly = japanChildAllowanceMonthly(childrenAges);
  return { monthly, annual: monthly * 12, currency: "JPY", countsOlderSiblingsAsSupported: childrenAges.some((age) => age > 18 && age <= 22), source: JAPAN_CHILD_ALLOWANCE_SOURCE };
}
