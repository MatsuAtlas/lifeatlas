import { cities } from "../data/cities.ts";
import { FALLBACK_FX_TO_JPY } from "../data/currencies.ts";
import { DEFAULT_PRIORITIES } from "./scoring/life-atlas-score.ts";
import type { PriorityKey } from "../types/scenario";
import type { UserProfile } from "../types/profile";

const priorityKeys: PriorityKey[] = ["savings", "purchasingPower", "qualityOfLife", "entrepreneurship", "fire", "family", "safety", "climate", "career", "remoteWork"];

export const DEFAULT_USER_PROFILE: UserProfile = {
  age: 29,
  householdType: "single",
  children: 0,
  baseCurrency: "JPY",
  currentCity: "tokyo",
  priorities: { ...DEFAULT_PRIORITIES },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUserProfile(value: unknown): value is UserProfile {
  if (!isObject(value) || !isObject(value.priorities)) return false;
  const priorities = value.priorities;
  return Number.isInteger(value.age) && Number(value.age) >= 18 && Number(value.age) <= 100
    && (value.householdType === "single" || value.householdType === "couple")
    && Number.isInteger(value.children) && Number(value.children) >= 0 && Number(value.children) <= 10
    && typeof value.baseCurrency === "string" && value.baseCurrency in FALLBACK_FX_TO_JPY
    && typeof value.currentCity === "string" && value.currentCity in cities
    && priorityKeys.every((key) => typeof priorities[key] === "number" && Number.isInteger(priorities[key]) && Number(priorities[key]) >= 0 && Number(priorities[key]) <= 5)
    && (value.updatedAt === undefined || typeof value.updatedAt === "string");
}

export function profileFromRow(value: unknown): UserProfile | null {
  if (!isObject(value)) return null;
  const profile: unknown = {
    age: value.age,
    householdType: value.household_type,
    children: value.children,
    baseCurrency: value.base_currency,
    currentCity: value.current_city,
    priorities: value.priorities,
    updatedAt: value.updated_at,
  };
  return isUserProfile(profile) ? profile : null;
}
