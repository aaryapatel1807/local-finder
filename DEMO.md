# Local Finder — 60–90 second demo script

Run the app in **mock mode** (default): `npm run dev`, open `http://localhost:3000`
on a phone or a narrow browser window. No API keys needed — all data comes from
`mock/search.json` + `mock/reviews.json`, so the demo burns zero SerpApi quota.
Allow the location prompt, or type **Vadodara** in the area box if it appears.

## The script (about 75 seconds)

**0:00 — Open the app.** "This is Local Finder. Type what you need, get places near
you — one screen, one input, results in under three seconds."

**0:10 — Tap the Pharmacy chip.** Three pharmacies appear with star ratings,
review counts, distance, and green **Open** badges. "Every card is scannable in one
second: name, stars, open status, distance."

**0:25 — Turn on the Open now toggle.** "The list filters instantly — no new API
call, it all happens on the results we already fetched."

**0:35 — Switch sort to Best match.** "Best match blends rating, review volume,
distance and open status with a Bayesian average — so a 5.0 with three reviews
doesn't beat a 4.6 with two thousand."

**0:45 — Tap the top card.** The details sheet slides up: today's hours, expandable
weekly hours, tap-to-call, address with copy button, and a directions button.
"This is everything you need standing on a street corner."

**0:58 — Scroll the sheet to the AI review summary.** "From recent reviews:
people like the quick service and fair prices; a few mention evening queues."
(Shown from the hand-written mock data; with a Groq key set, this is generated
live from real Google reviews and cached for 24 hours.)

**1:08 — Back on the home screen, type a messy query: `cheap chai open late`.**
Hit Go. "The AI parser turns that into a clean search — query, open-now filter,
price cap." (Without a Groq key it falls back to the raw text and still searches.)

**1:20 — Close.** "Every result is live Google Maps data through SerpApi in
production — with aggressive caching: 10-minute search cache, 20 searches per
IP per hour, and a monthly quota guard, because the free plan is ~100–250
searches a month. Favorites save to the Saved tab, and any search can be shared
as a link."

## If something goes wrong on stage

| Problem | Recovery line |
| --- | --- |
| Location prompt denied | Type **Vadodara** in the area box — "the city fallback is built in." |
| Zero results | "Try a wider radius — that's the 1/3/5/10 km selector." |
| Slow network | Skeleton cards hold the layout while results load. |
| Quota exceeded (live mode) | Switch back to mock mode — the demo data is identical in shape. |
