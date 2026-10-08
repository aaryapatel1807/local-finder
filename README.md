# Local Finder

A simple daily-life app built on SerpApi's Google Maps engine. Type what you need —
"pharmacy open now", "best chai" — and get ranked nearby places with ratings, hours,
distance and directions. One screen, one input, results in under three seconds.

## Features

- **Free-text search** with submit-on-Enter (no keystroke searching — saves API calls)
- **Quick chips**: Pharmacy, Chai, ATM, Petrol pump, Clinic, Stationery, Mechanic, Groceries
- **Geolocation** via the browser, with a city text-box fallback (defaults to Vadodara)
- **Result cards**: name, stars, review count, price level, address, distance, open/closed badge
- **Open now toggle** + **sort** (best match / nearest / top rated / most reviewed) — all client-side, no new API call
- **Radius selector**: 1 / 3 / 5 / 10 km (this one re-queries, it changes the SerpApi zoom)
- **Place details sheet**: weekly hours, tap-to-call, website, directions, copyable address
- **Map view**: Leaflet + OpenStreetMap tiles, marker per place, blue dot for you (toggle with list)
- **Favorites**: heart a place, view in the Saved tab (localStorage; syncs to the DB API when one is configured)
- **Recent searches**: last 5 queries under the search bar
- **Share**: copy a link that reopens the same search at the same location (`?q=&lat=&lng=&r=`)
- **Dark mode**: follows system preference, with a manual toggle
- **AI layer (optional)**: messy-query parsing ("cheap veg place open late near station" → structured filters) and two-line review summaries with pros/cons — via Groq free tier; the app works fully without it

## Phase 2 features

- **Smart query understanding**: word-sense disambiguation ("apple" → store vs juice shop) with one-tap
  "Did you mean…" chips; typo and transliteration tolerance ("pharmasy", "davakhana"); Hindi/Gujarati
  queries translated to English before searching — all in the existing `/api/parse` call, no extra SerpApi cost
- **"Near <landmark>" anchoring**: "near railway station" is geocoded (free Photon API, no key, 7-day cache)
  and the search recenters there
- **Conversational answers**: question-style queries ("where can I get medicine at 2am?") return an answer
  card with the top pick and 1–2 sentence reasons (`POST /api/answer`); hidden gracefully without a Groq key
- **Precise location**: GPS refinement (keeps the most accurate fix, shows a "±25 m" badge), a
  drag-the-pin "Set on map" mode (persisted), and a geocoded city text input instead of hardcoded cities
- **Walk/drive times** on every card via the free OSRM router (24h cache), with a haversine fallback
  marked "~" when OSRM is unreachable — lazy-loaded, never blocks rendering
- **Real open-now**: computed from weekly hours + current time (handles overnight hours), with an amber
  "Closes in X min" countdown where the data allows
- **Hidden-gem badges**: top-quartile Bayesian rating with <100 reviews
- **Review intelligence**: "good for" tags (late-night, family-friendly, budget…), best-time-to-visit hints,
  and review sentiment blended into the best-match score — all from the same Groq reviews call, zero extra cost
- **Ask about this place**: Q&A box in the details sheet answers from the fetched reviews only
  (prompt-injection guardrails), cached per place + question
- **Tap-to-load photo gallery** via SerpApi `google_maps_photos` — quota-guarded (hidden near the plan limit),
  24h cache, never auto-fetched
- **"For you" ranking**: a tiny on-device learner (perceptron-style, localStorage, zero server calls) reweights
  rating/distance/open/sentiment from your taps and saves; auto-suggests itself after 10+ interactions and
  learns your usual radius/sort as smart defaults
- **Semantic saved search**: "somewhere quiet to study" matches saved cafes by name/category text —
  pure TypeScript, no model downloads
- **Errand planner**: "pharmacy, ATM, groceries" → nearest option per category, ordered into a short walking loop
- **Meet in the middle**: two locations (pin or text) → searches around the geographic midpoint
- **Saved lists**: organize favorites into named lists with per-place notes
- **Compare up to 3 places** side by side (rating, reviews, distance, walk time, price, hours)
- **Price filter** (₹–₹₹₹), **late-night emergency mode** (open pharmacies/clinics/petrol, nearest first),
  **Surprise me**, **voice search** (Web Speech API), **WhatsApp share**, **recently viewed**
- **EN / हिं / ગુ UI toggle** (persisted) and **installable PWA** (offline app shell + saved places)
- **Quota meter**: "N searches used this month" from `/api/health`

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **TanStack Query** for server state, keyed `[query, lat, lng, radiusKm]`
- **Leaflet** + react-leaflet for maps (dynamically imported, `ssr: false`)
- **Zod** for request validation on every API route
- **SerpApi** (Google Maps + Google Maps Reviews engines) — the entire data layer; no place database
- **Groq** (free tier) for the optional AI layer
- **Prisma** + PostgreSQL for favorites/search logs/quota counter (optional — see below)
- **Vitest** for unit + API tests

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in keys as needed
npm run dev                  # http://localhost:3000
```

Out of the box the app runs in **mock mode** (`USE_MOCK=true`): it serves
`mock/search.json` + `mock/reviews.json`, makes zero SerpApi calls, and needs no keys.

## Environment variables

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `SERPAPI_KEY` | Only for live mode | — | SerpApi key (Google Maps + Google Maps Reviews engines). Never reaches the browser. |
| `GROQ_API_KEY` | No | — | Groq free-tier key for query parsing + review summaries. When empty, AI features degrade gracefully (raw-query fallback, summary hidden). |
| `GROQ_MODEL` | No | `openai/gpt-oss-120b` | Groq chat model for the AI layer. |
| `USE_MOCK` | No | `true` | `true` (default) serves mock data, zero SerpApi calls. Set `false` in production. |
| `MONTHLY_CALL_LIMIT` | No | `200` | SerpApi call budget; past it, `/api/search` returns `QUOTA_EXCEEDED` (503). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | No | — | Optional Upstash Redis L2 cache. When unset, an in-memory cache is used. |
| `DATABASE_URL` | No | — | Optional PostgreSQL. When unset, favorites use localStorage and counters stay in memory. |

> `.env.example` is committed to git and must stay **empty of real values**. Put real keys only in `.env.local` (gitignored) or your host's env settings.

## Mock vs live mode

- **Mock mode** (`USE_MOCK=true`, the default): every search is filtered from `mock/search.json`
  (15 Vadodara places); review summaries come from hand-written entries in `mock/reviews.json`.
  No network calls to SerpApi or Groq, no quota spent — ideal for UI development and demos.
- **Live mode** (`USE_MOCK=false` + `SERPAPI_KEY` set): real Google Maps results via SerpApi,
  real reviews fetched per place, AI summaries via Groq when `GROQ_API_KEY` is set.

## Quota notes

- SerpApi's **free plan is roughly 100–250 searches/month** — treat every call as precious.
- The app rate-limits **20 searches per IP per hour** (10/hour for the AI routes) and keeps a
  monthly counter; past `MONTHLY_CALL_LIMIT` it returns a friendly "Search is busy right now"
  instead of calling SerpApi.
- **Search results are cached 10 minutes**, keyed by normalized query + coordinates rounded to
  3 decimals (~110 m, so nearby users share entries). Review summaries are cached **24 hours**.
- Cache is two-level: in-memory L1, optional Upstash Redis L2.
- During development and demos, stay in mock mode or pre-warm the cache with your demo searches.

## Running

```bash
npm run dev      # dev server with hot reload
npm run build    # production build (type-checks + lints)
npm start        # serve the production build
```

## Tests

```bash
npm test         # vitest run — unit + API tests
```

Current suite: 190+ tests across `lib/` (openState incl. real open-now + countdown, distance, score incl.
sentiment blend + hidden-gem rule, normalize incl. dedupe, ai incl. disambiguation/tags/sentiment,
learner, semantic, errands, geocode, i18n dictionary) and the API routes
(`/api/search`, `/api/route`, `/api/ask`, `/api/photos` — mock mode, shape checks, 400/429/503 handling) — all green.

Type check: `npx tsc --noEmit`.

## Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Set environment variables in the Vercel dashboard:
   - `USE_MOCK=false`
   - `SERPAPI_KEY` = your SerpApi key (mark **Sensitive**)
   - `GROQ_API_KEY` = your Groq key (optional, mark **Sensitive**)
   - `MONTHLY_CALL_LIMIT` = `200` (or your plan's safe ceiling)
   - `DATABASE_URL` / `UPSTASH_*` only if you want the DB/Redis layers.
3. Deploy. No build configuration needed — `next build` is the default.
4. Sanity check: `GET /api/health` should return `{"ok":true,"mock":false,...}`.

## Project structure

```
app/
  page.tsx              # home: search, chips, filters, results, details sheet
  saved/page.tsx        # Saved tab (favorites)
  api/
    search/route.ts     # POST /api/search — validate → rate-limit → cache → SerpApi/mock → normalize → score
    place/[id]/route.ts # GET  /api/place/[id] — details for one place (from the search cache)
    reviews/route.ts    # POST /api/reviews — AI review summary (24h cache)
    parse/route.ts      # POST /api/parse — messy query → structured filters (Groq; graceful fallback)
    favorites/route.ts  # GET/POST/DELETE /api/favorites — anonymous favorites (DB optional)
    health/route.ts     # GET  /api/health — uptime + quota check
lib/
  schemas.ts  normalize.ts  openState.ts  score.ts  distance.ts
  serpapi.ts  ai.ts  cache.ts  ratelimit.ts  usage.ts  errors.ts  db.ts
components/             # SearchBar, CategoryChips, FilterBar, PlaceCard, PlaceSheet,
                        # MapView (Leaflet, ssr:false), EmptyState, ErrorState, Toast, …
hooks/                  # useSearch, useGeolocation, useFavorites, useHealth, useLocalStorage, …
mock/                   # search.json + reviews.json (mock mode data)
prisma/schema.prisma    # User / Favorite / Search models (DB optional)
```

## API reference

| Route | Request | Response |
| --- | --- | --- |
| `POST /api/search` | `{ query, lat, lng, radiusKm: 1\|3\|5\|10 }` | `{ cached, count, places: Place[], mock? }` |
| `GET /api/place/[id]` | — | `{ place: Place }` or `404 NOT_FOUND` |
| `POST /api/reviews` | `{ dataId, placeName }` | `{ summary, pros[], cons[], basedOn, tags[], sentiment (-1..1), bestTimeHint?, cached, mock?, aiDisabled? }` (`summary` may be empty → hide the AI section) |
| `POST /api/parse` | `{ text }` | `{ parsed: { query, openNow, priceMax?, near?, sort, ambiguous?: { term, options: [{label, query}] }, detectedLang? } \| null, aiDisabled?, fallbackQuery? }` |
| `GET /api/geocode?q=` | — | `{ lat, lng, label }` or `404 NO_RESULTS` (Photon, free, 7-day cache) |
| `GET /api/route?from=lat,lng&to=lat,lng&mode=walk\|drive` | — | `{ durationMin, distanceKm, mode, estimated }` (`estimated: true` = haversine fallback when OSRM is down; 24h cache, estimates never cached) |
| `POST /api/answer` | `{ text, lat, lng, radiusKm }` | `{ answer: { place, reasons[], summary } \| null, query, cached, aiDisabled? }` (null → show normal results) |
| `POST /api/ask` | `{ dataId?, placeName, question }` | `{ answer: string \| null, basedOn }` (answered from reviews only; 24h cache) |
| `GET /api/photos?dataId=` | — | `{ photos: [{url}] }` — 503 `QUOTA_NEAR_LIMIT` when ≥90% of the monthly quota is used (section hidden); 24h cache |
| `GET /api/favorites` | — | `{ localOnly, favorites? }` (`localOnly: true` when no DB — frontend uses localStorage) |
| `POST /api/favorites` | `{ place }` | `{ localOnly?, favorite }` |
| `DELETE /api/favorites?id=` | — | `{ localOnly?, deleted, id }` |
| `GET /api/health` | — | `{ ok: true, mock, callsThisMonth }` |

Error shape: `{ error: { code, message } }` with HTTP status.
Codes: `INVALID_INPUT` (400), `RATE_LIMITED` (429), `QUOTA_EXCEEDED` (503), `UPSTREAM_ERROR` (502), `NOT_FOUND` (404).

`Place` (spec 7.4): `id, dataId?, name, category?, rating?, reviews?, price?, address?, phone?, website?, openLabel?, isOpen (bool|null), closesSoon, minutesToClose?, hoursToday?, weeklyHours?, lat, lng, distanceKm?, thumbnail?, score? (0–100 best-match)`.

## Privacy

Your location is sent to our server only to find places near you. It is never sold, never
shared with advertisers, and in the default configuration it isn't stored at all —
favorites live in your browser's localStorage unless a database is explicitly configured.

## What's intentionally stubbed

- **Database**: `prisma/schema.prisma` defines the models, but no client is generated in this
  repo — generating one needs a working Prisma 7 toolchain plus a `DATABASE_URL`. Until then
  `lib/db.ts` returns `null` and everything runs without a database (favorites → localStorage,
  counters → in-memory). Nothing breaks; the API routes degrade to `{ localOnly: true }`.
- **AI layer**: fully optional. No Groq key → query parsing falls back to the raw text and
  review summaries stay hidden instead of erroring.
- **SerpApi**: mock mode is the default, so the app is fully usable with zero API keys.
