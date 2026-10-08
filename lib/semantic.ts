/**
 * Lightweight on-device semantic match (Phase 2 ML workstream).
 *
 * No model downloads, no server calls — just tokenization, stopword removal,
 * a small synonym map (EN + common Hinglish), and weighted cosine similarity
 * over name / category / address fields.
 */

/** Stopwords: small EN list + common Hinglish transliterations. */
const STOPWORDS = new Set([
  // English
  "a", "an", "the", "to", "of", "for", "and", "or", "in", "on", "at", "is",
  "it", "this", "that", "with", "near", "me", "my", "some", "any", "where",
  "find", "get", "give", "need", "want", "looking", "search", "show", "best",
  "good", "place", "places", "spot", "shop", "shops", "nearby", "around",
  "here", "there", "open", "now", "new", "very", "really", "just", "like",
  "have", "has", "are", "was", "were", "be", "do", "does", "will", "would",
  "can", "could", "please", "one", "two", "few", "also", "only", "well",
  // Hinglish transliterations
  "ke", "ki", "ka", "ko", "mein", "me", "main", "aur", "ya", "se", "koi",
  "kuch", "chahiye", "batao", "dikhao", "achha", "wala", "wale", "wali",
  "pass", "paas", "nazdeek", "aas", "paas",
]);

/** Synonym expansions: query token → additional equivalent tokens. */
const SYNONYMS: Record<string, string[]> = {
  quiet: ["calm", "peaceful", "cozy"],
  calm: ["quiet", "peaceful", "cozy"],
  peaceful: ["quiet", "calm", "cozy"],
  cozy: ["quiet", "calm", "peaceful"],
  study: ["work", "read", "books", "cafe"],
  work: ["study", "office"],
  read: ["study", "books"],
  books: ["study", "read", "bookstore"],
  cheap: ["budget", "affordable"],
  budget: ["cheap", "affordable"],
  affordable: ["cheap", "budget"],
  coffee: ["cafe"],
  cafe: ["coffee"],
  food: ["restaurant", "dining", "eatery"],
  restaurant: ["food", "dining", "eatery"],
  dining: ["food", "restaurant"],
  medicine: ["pharmacy", "medical"],
  pharmacy: ["medicine", "medical", "chemist"],
  medical: ["pharmacy", "medicine", "hospital", "clinic"],
  chemist: ["pharmacy", "medicine"],
  hospital: ["medical", "clinic"],
  clinic: ["medical", "hospital", "doctor"],
  doctor: ["clinic", "hospital"],
  hotel: ["stay", "lodging", "resort"],
  stay: ["hotel", "lodging"],
  lodging: ["hotel", "stay"],
  bar: ["pub", "drinks", "nightlife"],
  pub: ["bar", "drinks"],
  drinks: ["bar", "pub", "cafe"],
  party: ["nightlife", "club"],
  club: ["nightlife", "party"],
  gym: ["fitness", "workout", "exercise"],
  fitness: ["gym", "workout"],
  workout: ["gym", "fitness"],
  park: ["garden", "green", "outdoor"],
  garden: ["park", "green"],
  outdoor: ["park", "garden"],
  fuel: ["petrol", "gas", "pump"],
  petrol: ["fuel", "gas", "pump"],
  pump: ["fuel", "petrol"],
  atm: ["bank", "cash", "money"],
  bank: ["atm", "cash"],
  cash: ["atm", "bank"],
  mall: ["shopping", "market"],
  shopping: ["mall", "market"],
  market: ["mall", "shopping"],
  bakery: ["cake", "bread", "dessert"],
  cake: ["bakery", "dessert"],
  dessert: ["bakery", "cake", "icecream"],
  icecream: ["dessert", "bakery"],
  pizza: ["italian", "fastfood"],
  burger: ["fastfood"],
  fastfood: ["burger", "pizza"],
  tea: ["chai", "cafe"],
  chai: ["tea", "cafe"],
  breakfast: ["brunch", "morning"],
  lunch: ["dining", "restaurant"],
  dinner: ["dining", "restaurant"],
  late: ["night", "24hr"],
  night: ["late", "nightlife"],
  vegetarian: ["veg", "pureveg"],
  veg: ["vegetarian", "pureveg"],
  nonveg: ["non-vegetarian", "chicken"],
  chicken: ["nonveg"],
  spa: ["massage", "salon"],
  salon: ["spa", "haircut", "beauty"],
  haircut: ["salon", "barber"],
  barber: ["salon", "haircut"],
  library: ["books", "study", "read"],
  cinema: ["movie", "theatre", "theater"],
  movie: ["cinema", "theatre"],
  theatre: ["cinema", "movie"],
  theater: ["cinema", "movie"],
  museum: ["art", "gallery", "history"],
  gallery: ["art", "museum"],
  art: ["gallery", "museum"],
  temple: ["religious", "mandir", "worship"],
  mandir: ["temple", "religious"],
  church: ["religious", "worship"],
  mosque: ["religious", "worship"],
  school: ["education", "coaching"],
  education: ["school", "coaching"],
  coaching: ["school", "education"],
  college: ["university", "campus"],
  university: ["college", "campus"],
  laundry: ["dryclean", "wash"],
  dryclean: ["laundry", "wash"],
  tailoring: ["tailor", "stitch"],
  tailor: ["tailoring", "stitch"],
  repair: ["service", "fix"],
  service: ["repair"],
  carwash: ["car", "wash", "detailing"],
  parking: ["park", "garage"],
  garage: ["parking", "repair"],
  taxi: ["cab", "ride"],
  cab: ["taxi", "ride"],
  ride: ["taxi", "cab"],
  wifi: ["internet", "cafe"],
  internet: ["wifi"],
  pet: ["veterinary", "animals"],
  veterinary: ["pet", "vet"],
  vet: ["pet", "veterinary"],
  florist: ["flowers"],
  flowers: ["florist"],
  jewelry: ["jewellery", "gold"],
  jewellery: ["jewelry", "gold"],
  electronics: ["mobile", "gadgets", "appliances"],
  mobile: ["electronics", "phone"],
  phone: ["mobile", "electronics"],
  optics: ["eyewear", "glasses", "spectacles"],
  glasses: ["optics", "eyewear"],
};

/** Field weights for the document vector. */
const FIELD_WEIGHTS = { name: 3, category: 2, address: 1 } as const;

type TermVec = Map<string, number>;

/** Lowercase, split on non-alphanumerics, drop stopwords. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Synonym expansion applied to both query and document tokens. */
function expandTokens(tokens: string[]): string[] {
  const out = new Set<string>(tokens);
  tokens.forEach((t) => {
    const syns = SYNONYMS[t];
    if (syns) syns.forEach((s) => out.add(s));
  });
  return Array.from(out);
}

function termVec(tokens: string[], weight = 1): TermVec {
  const vec: TermVec = new Map();
  for (const t of tokens) {
    vec.set(t, (vec.get(t) ?? 0) + weight);
  }
  return vec;
}

function cosineSimilarity(a: TermVec, b: TermVec): number {
  let dot = 0;
  a.forEach((wa, term) => {
    const wb = b.get(term);
    if (wb !== undefined) dot += wa * wb;
  });
  if (dot === 0) return 0;
  let na = 0;
  a.forEach((w) => { na += w * w; });
  let nb = 0;
  b.forEach((w) => { nb += w * w; });
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type SemanticDoc = {
  name: string;
  category?: string;
  address?: string;
};

/**
 * Weighted cosine similarity between the (synonym-expanded) query and the
 * document, where doc terms are weighted by field: name ×3, category ×2,
 * address ×1. Returns 0 for an empty query (after stopword removal).
 *
 * Exact-name matches get a boost so they always rank at the top.
 */
export function semanticScore(query: string, doc: SemanticDoc): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;

  const qVec = termVec(expandTokens(tokens));
  const dVec: TermVec = new Map();
  const add = (text: string | undefined, weight: number) => {
    if (!text) return;
    for (const t of expandTokens(tokenize(text))) {
      dVec.set(t, (dVec.get(t) ?? 0) + weight);
    }
  };
  add(doc.name, FIELD_WEIGHTS.name);
  add(doc.category, FIELD_WEIGHTS.category);
  add(doc.address, FIELD_WEIGHTS.address);
  if (dVec.size === 0) return 0;

  let score = cosineSimilarity(qVec, dVec);

  // Exact name match boost: the name matches a query token exactly.
  const nameTokens = new Set(tokenize(doc.name));
  const hasExact = tokens.some((t) => nameTokens.has(t));
  if (hasExact) score = Math.min(1, score + 0.25);

  return Math.round(score * 1000) / 1000;
}
