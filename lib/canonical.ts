/**
 * Query canonicalization — map spelling variants, transliterations and
 * synonyms to ONE canonical English key so variant queries share a single
 * cached SerpApi call (quota-minimal architecture).
 *
 * Deterministic and offline: no AI needed, so it works even when
 * GROQ_API_KEY is absent. The AI parser (/api/parse) handles the harder
 * cases (typos, Hindi/Gujarati); this runs on the cleaned query and on
 * raw input in /api/search as a safety net so variants share cache keys.
 */

/** alias -> canonical key. */
const ALIASES: [string, string][] = [
  // pharmacy
  ["medical store", "pharmacy"],
  ["medicine shop", "pharmacy"],
  ["drug store", "pharmacy"],
  ["davakhana", "pharmacy"],
  ["dawakhana", "pharmacy"],
  ["pharmasy", "pharmacy"],
  ["medikal", "pharmacy"],
  ["chemist", "pharmacy"],
  ["pharmacy", "pharmacy"],
  // chai / cafe
  ["tea stall", "chai"],
  ["chai tapri", "chai"],
  ["tapri", "chai"],
  ["chai", "chai"],
  ["coffee shop", "cafe"],
  ["coffee", "cafe"],
  ["cafe", "cafe"],
  // atm
  ["cash machine", "atm"],
  ["atm machine", "atm"],
  ["atm", "atm"],
  // petrol
  ["petrol pump", "petrol"],
  ["gas station", "petrol"],
  ["fuel station", "petrol"],
  ["petrol", "petrol"],
  ["fuel", "petrol"],
  // clinic / hospital
  ["clinic", "clinic"],
  ["hospital", "hospital"],
  ["hosptial", "hospital"],
  // restaurant
  ["restorent", "restaurant"],
  ["restaurant", "restaurant"],
  // groceries
  ["kirana store", "groceries"],
  ["kirana", "groceries"],
  ["grocery store", "groceries"],
  ["grocery", "groceries"],
  ["groceries", "groceries"],
  ["supermarket", "groceries"],
  // stationery
  ["stationery shop", "stationery"],
  ["stationery", "stationery"],
  // mechanic
  ["car repair", "mechanic"],
  ["bike repair", "mechanic"],
  ["mechanic", "mechanic"],
  ["garage", "mechanic"],
  // bank
  ["bank", "bank"],
  // salon
  ["hair salon", "salon"],
  ["nail salon", "salon"],
  ["salon", "salon"],
  ["barber", "salon"],
];

/** Longest aliases first so "medical store" wins over "store"-like noise. */
const SORTED = [...ALIASES].sort((a, b) => b[0].length - a[0].length);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Normalize raw input the same way everywhere (cache keys included). */
export function normalizeQueryText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a query to its canonical key. Whole-word matching only ("bank"
 * matches "the bank nearby" but not "riverbank"). Returns the normalized
 * input unchanged when no alias matches.
 */
export function canonicalKey(text: string): string {
  const normalized = normalizeQueryText(text);
  if (!normalized) return normalized;
  for (const [alias, canonical] of SORTED) {
    const re = new RegExp(`(^|\\s)${escapeRegExp(alias)}(\\s|$)`);
    if (re.test(normalized)) return canonical;
  }
  return normalized;
}
