/**
 * Wikimedia Commons image lookup — free, no key, real photos.
 *
 * OSM has no photo data, and SerpApi photos need a key + quota. Commons
 * gives us real Creative Commons photos for notable places via a simple
 * search by name. Coverage varies (great for landmarks, sparse for small
 * shops), so callers must handle "no image" gracefully with a category
 * fallback illustration.
 */

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const TIMEOUT_MS = 8000;

export interface CommonsImage {
  url: string;
  thumbUrl: string;
  title: string;
}

/**
 * Search Commons for a photo of `query` (usually "Place Name, City").
 * Returns the first usable image, or null when nothing is found.
 */
export async function findCommonsImage(query: string): Promise<CommonsImage | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6", // File namespace only
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "600",
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${COMMONS_API}?${params.toString()}`, {
      headers: { "User-Agent": "LocalFinder/1.0 (hackathon; contact: local-finder)" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; imageinfo?: [{ thumburl?: string; url?: string }] }> };
    };
    const pages = json.query?.pages;
    if (!pages) return null;

    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl || info?.url;
      if (!url) continue;
      // Skip icons, logos, maps — we want photos.
      const lower = (page.title || "").toLowerCase();
      if (/\b(icon|logo|map|diagram|symbol)\b/.test(lower)) continue;
      return { url, thumbUrl: info?.thumburl || url, title: page.title || "" };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
