import type { CityId, CurrencyCode } from "./city";
import type { ScenarioHousehold, UserPriorities } from "./scenario";

export type UserProfile = {
  age: number;
  householdType: ScenarioHousehold;
  children: number;
  baseCurrency: CurrencyCode;
  currentCity: CityId;
  priorities: UserPriorities;
  updatedAt?: string;
};
