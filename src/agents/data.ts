// Deterministic pseudo-random data generation for specialist agents.
// Same (agentId, inputs) always produces the same result; agents differ.

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(agentId: string, inputs: unknown): () => number {
  return mulberry32(hashString(agentId + JSON.stringify(inputs ?? {})));
}

export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function int(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function money(rng: () => number, min: number, max: number): number {
  return Math.round(min + rng() * (max - min));
}

// ---- flight_search ----

export interface FlightOption {
  airline: string;
  from: string;
  to: string;
  depart: string;
  return: string;
  stops: number;
  duration_h: number;
  price_eur: number;
}

const AIRLINES = ["ANA", "JAL", "Lufthansa", "Turkish Airlines", "Finnair", "Qatar Airways"];

export function flightOptions(
  rng: () => number,
  origin: string,
  destination: string,
  dates: string,
  style: "budget" | "premium" | "cheap"
): FlightOption[] {
  const [depart, ret] = dates.split("..");
  const options: FlightOption[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 3; i++) {
    let airline = pick(rng, AIRLINES);
    while (used.has(airline)) airline = pick(rng, AIRLINES);
    used.add(airline);
    const stops =
      style === "premium" ? int(rng, 0, 1) : style === "cheap" ? int(rng, 1, 3) : int(rng, 0, 2);
    const price =
      style === "premium"
        ? money(rng, 900, 1600)
        : style === "cheap"
          ? money(rng, 320, 520)
          : money(rng, 550, 900);
    options.push({
      airline,
      from: origin,
      to: destination,
      depart: depart ?? "2026-10-01",
      return: ret ?? "2026-10-05",
      stops,
      duration_h: Math.round((11 + stops * 2.5 + rng() * 3) * 10) / 10,
      price_eur: price,
    });
  }
  options.sort((a, b) =>
    style === "premium" ? a.stops - b.stops || a.duration_h - b.duration_h : a.price_eur - b.price_eur
  );
  return options;
}

// ---- hotel_search ----

export interface HotelOption {
  name: string;
  area: string;
  stars: number;
  price_per_night_eur: number;
  total_eur: number;
  rating: number;
}

const TOKYO_AREAS = ["Shinjuku", "Shibuya", "Asakusa", "Ginza", "Ueno"];

const HOTEL_NAMES: Record<string, string[]> = {
  midrange: ["Hotel Sunroute", "Shibuya Excel", "Asakusa View", "Ginza Creston", "Ueno First"],
  hostel: ["Khaosan Tokyo", "Nine Hours", "Wise Owl Hostel", "Unplan Kagurazaka"],
  luxe: ["Aman Tokyo", "Park Hyatt", "The Peninsula", "Mandarin Oriental"],
  ryokan: ["Hanare Ryokan", "Sawanoya", "Andon Ryokan", "Homeikan"],
  business: ["APA Hotel", "Toyoko Inn Premier", "Daiwa Roynet", "Hotel Villa Fontaine"],
};

export type HotelStyle = "midrange" | "hostel" | "luxe" | "ryokan" | "business";

export function hotelOptions(
  rng: () => number,
  destination: string,
  nights: number,
  style: HotelStyle
): HotelOption[] {
  const names = HOTEL_NAMES[style];
  const starRange: Record<HotelStyle, [number, number]> = {
    midrange: [3, 4],
    hostel: [1, 2],
    luxe: [5, 5],
    ryokan: [3, 4],
    business: [3, 4],
  };
  const priceRange: Record<HotelStyle, [number, number]> = {
    midrange: [110, 220],
    hostel: [25, 60],
    luxe: [550, 900],
    ryokan: [180, 320],
    business: [90, 160],
  };
  const [sMin, sMax] = starRange[style];
  const [pMin, pMax] = priceRange[style];
  const options: HotelOption[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 3; i++) {
    let name = pick(rng, names);
    while (used.has(name)) name = pick(rng, names);
    used.add(name);
    const ppn = money(rng, pMin, pMax);
    options.push({
      name,
      area: pick(rng, TOKYO_AREAS),
      stars: int(rng, sMin, sMax),
      price_per_night_eur: ppn,
      total_eur: ppn * nights,
      rating: Math.round((3.8 + rng() * 1.1) * 10) / 10,
    });
  }
  options.sort((a, b) => b.rating - a.rating);
  return options;
}

// ---- activity_search ----

export interface ActivityItem {
  time: string;
  title: string;
  area: string;
  cost_eur: number;
}

const ACTIVITY_POOLS: Record<string, { title: string; area: string; cost: [number, number] }[]> = {
  gems: [
    { title: "Yanaka Ginza backstreet walk", area: "Yanaka", cost: [0, 5] },
    { title: "Shimokitazawa vintage shops", area: "Shimokitazawa", cost: [0, 15] },
    { title: "Kagurazaka hidden alleys", area: "Kagurazaka", cost: [0, 8] },
    { title: "Koenji live-house crawl", area: "Koenji", cost: [5, 20] },
    { title: "Todoroki Valley hike", area: "Setagaya", cost: [0, 0] },
    { title: "Kiyosumi garden tea house", area: "Kiyosumi", cost: [3, 10] },
  ],
  culture: [
    { title: "Senso-ji at dawn", area: "Asakusa", cost: [0, 0] },
    { title: "Meiji Shrine & forest walk", area: "Shibuya", cost: [0, 0] },
    { title: "teamLab Planets", area: "Toyosu", cost: [30, 38] },
    { title: "Tokyo National Museum", area: "Ueno", cost: [8, 12] },
    { title: "Tea ceremony experience", area: "Ginza", cost: [40, 60] },
    { title: "Edo-Tokyo Open Air Museum", area: "Koganei", cost: [4, 8] },
  ],
  nightlife: [
    { title: "Golden Gai bar hop", area: "Shinjuku", cost: [20, 50] },
    { title: "Omoide Yokocho yakitori", area: "Shinjuku", cost: [15, 30] },
    { title: "Shibuya crossing + club WOMB", area: "Shibuya", cost: [25, 45] },
    { title: "Roppongi jazz lounge", area: "Roppongi", cost: [30, 60] },
    { title: "Karaoke Kan session", area: "Shibuya", cost: [15, 25] },
    { title: "Rooftop beer garden", area: "Ginza", cost: [20, 40] },
  ],
  family: [
    { title: "Ueno Zoo & pandas", area: "Ueno", cost: [5, 8] },
    { title: "Ghibli Museum", area: "Mitaka", cost: [10, 15] },
    { title: "Tokyo Disneyland day", area: "Maihama", cost: [60, 90] },
    { title: "Legoland Discovery Center", area: "Odaiba", cost: [20, 30] },
    { title: "Sumida Aquarium", area: "Tokyo Skytree", cost: [18, 25] },
    { title: "Kawaii Monster Café (photo op)", area: "Harajuku", cost: [15, 30] },
  ],
};

export type ActivityStyle = "gems" | "culture" | "nightlife" | "family";

const TIMES = ["09:00", "13:00", "17:00", "20:00"];

export function activityDays(
  rng: () => number,
  destination: string,
  numDays: number,
  style: ActivityStyle
): { day: number; items: ActivityItem[] }[] {
  const pool = [...ACTIVITY_POOLS[style]];
  const days: { day: number; items: ActivityItem[] }[] = [];
  for (let d = 1; d <= numDays; d++) {
    const count = int(rng, 2, 3);
    const items: ActivityItem[] = [];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length);
      const [act] = pool.splice(idx, 1);
      items.push({
        time: TIMES[i] ?? "21:00",
        title: act.title,
        area: act.area,
        cost_eur: money(rng, act.cost[0], act.cost[1]),
      });
    }
    days.push({ day: d, items });
  }
  return days;
}

// ---- currency_conversion ----

export const FX_RATES: Record<string, number> = {
  "EUR>JPY": 162.4,
  "USD>JPY": 149.8,
  "EUR>USD": 1.08,
  "USD>EUR": 0.926,
  "GBP>JPY": 190.1,
  "EUR>GBP": 0.855,
  "JPY>EUR": 0.00616,
  "JPY>USD": 0.00668,
};

export function fxRate(from: string, to: string): number | null {
  if (from === to) return 1;
  return FX_RATES[`${from}>${to}`] ?? null;
}

// ---- translation ----

export const PHRASES: Record<string, Record<string, string>> = {
  "Where is the train station?": { ja: "駅はどこですか？" },
  "Thank you very much": { ja: "ありがとうございます" },
  "A table for two, please": { ja: "二人用のテーブルをお願いします" },
  "How much does this cost?": { ja: "これはいくらですか？" },
};

// ---- web_research ----

export const TOKYO_FACTS = [
  {
    title: "Best time to visit Tokyo",
    snippet: "Late March (cherry blossoms) and October–November (mild, autumn foliage) are peak windows; October averages 18–22°C.",
    source: "japan-guide.com",
  },
  {
    title: "Getting from the airport",
    snippet: "NRT → central Tokyo via Narita Express (53 min, ¥3,070) or Skyliner to Ueno (41 min, ¥2,570). Haneda is 30 min by monorail.",
    source: "tokyo-airport-transit",
  },
  {
    title: "Transit passes",
    snippet: "A Suica/Pasmo IC card covers all trains and metros; 72-hour Tokyo Subway Ticket (~¥1,500) pays off after ~5 rides.",
    source: "tokyo-metro",
  },
  {
    title: "Neighborhood guide",
    snippet: "Shinjuku for nightlife and transit hub, Asakusa for old Tokyo, Shibuya for youth culture, Ginza for upscale dining.",
    source: "lonely-planet",
  },
  {
    title: "Cash vs card",
    snippet: "Japan is still cash-friendly; carry ¥10–20k. IC cards and credit cards are accepted at most hotels and chains.",
    source: "japan-travel-faq",
  },
];
