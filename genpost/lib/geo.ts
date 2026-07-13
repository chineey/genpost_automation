// ─── African country codes (ISO 3166-1 alpha-2) ───────────────────────────────
// Used to route African visitors to Paystack/NGN pricing
export const AFRICAN_COUNTRY_CODES = new Set([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD",
  "KM", "CG", "CD", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA",
  "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW",
  "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST",
  "SN", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG",
  "ZM", "ZW", "EH", "RE", "YT", "SH",
]);

export type Currency = "ngn" | "usd";
export type Region = "africa" | "global";

export function countryToRegion(countryCode: string | null | undefined): Region {
  if (!countryCode) return "global";
  return AFRICAN_COUNTRY_CODES.has(countryCode.toUpperCase()) ? "africa" : "global";
}

export function regionToCurrency(region: Region): Currency {
  return region === "africa" ? "ngn" : "usd";
}
