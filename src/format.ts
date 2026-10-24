import type { CurrencyPreferences } from "./features/admin/model";
let preferences: CurrencyPreferences = {
  code: "INR",
  locale: "en-IN",
  display: "symbol",
  minimumDigits: 0,
  maximumDigits: 2,
};
export function configureMoney(value?: CurrencyPreferences) {
  preferences = value || {
    code: "INR",
    locale: "en-IN",
    display: "symbol",
    minimumDigits: 0,
    maximumDigits: 2,
  };
}
export function formatINR(value: number) {
  return new Intl.NumberFormat(preferences.locale, {
    style: "currency",
    currency: "INR",
    currencyDisplay: preferences.display,
    minimumFractionDigits: preferences.minimumDigits,
    maximumFractionDigits: preferences.maximumDigits,
  }).format(Object.is(value, -0) ? 0 : value);
}
