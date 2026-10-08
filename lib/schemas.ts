/**
 * Zod schemas shared by the API routes.
 * These validate every request body and the AI layer's JSON output.
 */
import { z } from "zod";

/**
 * POST /api/search request body.
 * radiusKm is one of 1 | 3 | 5 | 10 (arrives as a JSON number).
 */
export const SearchRequestSchema = z.object({
  query: z.string().min(1, "query is required").max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z
    .number()
    .refine((v) => [1, 3, 5, 10].includes(v), {
      message: "radiusKm must be one of 1, 3, 5, 10",
    }),
});

/** POST /api/parse request body. */
export const ParseRequestSchema = z.object({
  text: z.string().min(1, "text is required").max(300),
});

/** POST /api/reviews request body. */
export const ReviewsRequestSchema = z.object({
  dataId: z.string().min(1, "dataId is required"),
  placeName: z.string().min(1, "placeName is required").max(120),
});

/**
 * Normalized place shape (spec section 7.4). Used to validate the favorite
 * payload so a bad client can't stash arbitrary blobs in the DB.
 */
export const PlaceSchema = z.object({
  id: z.string(),
  dataId: z.string().optional(),
  name: z.string(),
  category: z.string().optional(),
  rating: z.number().optional(),
  reviews: z.number().int().optional(),
  price: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  openLabel: z.string().optional(),
  isOpen: z.boolean().nullable(),
  closesSoon: z.boolean(),
  minutesToClose: z.number().optional(),
  hoursToday: z.string().optional(),
  weeklyHours: z.record(z.string(), z.string()).optional(),
  lat: z.number(),
  lng: z.number(),
  distanceKm: z.number().optional(),
  thumbnail: z.string().optional(),
  score: z.number().optional(),
  /**
   * Data tier that produced this place: SerpApi (rich: ratings/reviews)
   * or OSM (free community data, no ratings). Absent for mock/demo
   * entries, which mimic the SerpApi shape.
   */
  source: z.enum(["serpapi", "osm"]).optional(),
});

export type Place = z.infer<typeof PlaceSchema>;

/** POST /api/favorites request body. */
export const FavoriteBodySchema = z.object({
  place: PlaceSchema,
});

/**
 * Output contract for the AI query parser (spec 8.4).
 * priceMax: 0 = cheapest .. 4 = most expensive (optional, model may omit).
 * ambiguous: set ONLY when the search term is genuinely ambiguous (the
 * model offers 2-3 disambiguated options); omitted otherwise.
 */
export const ParsedQuerySchema = z.object({
  query: z.string().min(1),
  openNow: z.boolean().default(false),
  priceMax: z.number().int().min(0).max(4).optional(),
  near: z.string().optional(),
  sort: z.enum(["best", "nearest", "rating", "reviews"]).default("best"),
  ambiguous: z
    .object({
      term: z.string(),
      options: z
        .array(z.object({ label: z.string(), query: z.string() }))
        .min(2)
        .max(3),
    })
    .optional(),
  /**
   * Detected query language: 'hi' for Hindi, 'gu' for Gujarati
   * (Devanagari/Gujarati script or transliterated). Omitted for English.
   */
  detectedLang: z.enum(["hi", "gu", "en"]).optional(),
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

/**
 * AI review-summary output contract (spec 8.3).
 * tags/sentiment come from the same summarize call (phase 2); both
 * optional so older caches and mock entries stay valid.
 */
export const ReviewSummarySchema = z.object({
  summary: z.string(),
  pros: z.array(z.string()).max(3),
  cons: z.array(z.string()).max(3),
  basedOn: z.number().int(),
  tags: z.array(z.string()).optional(),
  sentiment: z.number().min(-1).max(1).optional(),
  /**
   * One-line busy/quiet hint from the SAME summarize call (zero extra
   * cost), e.g. "busy evenings, quiet before noon". The model omits it
   * unless the reviews actually support it.
   */
  bestTimeHint: z.string().optional(),
});

/** Shared radiusKm validation (1 | 3 | 5 | 10 km). */
const RadiusKmSchema = z.number().refine((v) => [1, 3, 5, 10].includes(v), {
  message: "radiusKm must be one of 1, 3, 5, 10",
});

/** POST /api/answer request body: a natural-language question + location. */
export const AnswerRequestSchema = z.object({
  text: z.string().min(1, "text is required").max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: RadiusKmSchema,
});

export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;
