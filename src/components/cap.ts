export const CAP_MONOGRAM: Record<string, string> = {
  flight_search: "FL",
  hotel_search: "HO",
  activity_search: "AC",
  currency_conversion: "FX",
  translation: "TR",
  web_research: "RS",
};

export const CAP_COLOR: Record<string, string> = {
  flight_search: "#818cf8",
  hotel_search: "#f472b6",
  activity_search: "#34d399",
  currency_conversion: "#fbbf24",
  translation: "#22d3ee",
  web_research: "#a78bfa",
};

const SHORT_NAMES: Record<string, string> = {
  flight_search: "flight",
  hotel_search: "hotel",
  activity_search: "activity",
  currency_conversion: "fx",
  translation: "translate",
  web_research: "research",
};

export function capMonogram(cap: string): string {
  return CAP_MONOGRAM[cap] ?? cap.slice(0, 2).toUpperCase();
}

export function shortCap(cap: string): string {
  return SHORT_NAMES[cap] ?? cap.replace(/_search$/, "");
}
