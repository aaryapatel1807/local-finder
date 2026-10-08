/**
 * Directions helpers for GET /api/route.
 *
 * Uses the OSRM public demo server (keyless, ₹0) with the driving profile:
 *   drive -> duration/60 minutes, distance/1000 km
 *   walk  -> OSRM demo has no foot profile, so minutes = distanceKm / 5 * 60
 *
 * Exported from here (not from the route file) because Next.js route
 * modules may only export route handlers.
 */

import { z } from "zod";

export const ROUTE_CACHE_TTL_SEC = 24 * 60 * 60; // 24h
export const WALK_SPEED_KMH = 5;

export type LatLng = { lat: number; lng: number };

/** Parse "lat,lng"; null when malformed or out of range. */
export function parseLatLng(s: string): LatLng | null {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Cache key: route:{mode}:{rounded from}:{rounded to}. */
export function routeCacheKey(
  mode: string,
  from: LatLng,
  to: LatLng
): string {
  const f = `${from.lat.toFixed(3)},${from.lng.toFixed(3)}`;
  const t = `${to.lat.toFixed(3)},${to.lng.toFixed(3)}`;
  return `route:${mode}:${f}:${t}`;
}

const OsrmSchema = z.object({
  routes: z
    .array(
      z.object({
        duration: z.number().finite().positive(),
        distance: z.number().finite().positive(),
      })
    )
    .min(1),
});

export type RouteResult = {
  durationMin: number;
  distanceKm: number;
  mode: "walk" | "drive";
};

/**
 * Compute the route via the OSRM demo server. Throws on ANY failure —
 * the handler maps it to 503 ROUTE_UNAVAILABLE.
 */
export async function computeRoute(
  from: LatLng,
  to: LatLng,
  mode: "walk" | "drive"
): Promise<RouteResult> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const json: unknown = await res.json();
  const parsed = OsrmSchema.safeParse(json);
  if (!parsed.success) throw new Error("OSRM returned no usable route");
  const leg = parsed.data.routes[0];

  const distanceKm = leg.distance / 1000;
  const minutes =
    mode === "drive" ? leg.duration / 60 : (distanceKm / WALK_SPEED_KMH) * 60;

  return {
    durationMin: Math.round(minutes),
    distanceKm: Math.round(distanceKm * 10) / 10,
    mode,
  };
}
