/**
 * /api/favorites — anonymous favorites (spec 8.5, DB optional).
 *
 * Identity is an anonymous session cookie `lf_sid` (httpOnly, 1 year).
 * No sign-up, no email — the app works immediately.
 *
 * - GET:    { localOnly, favorites[] }
 * - POST:   { place } -> { localOnly?, favorite }
 * - DELETE: ?id=<placeId> -> { localOnly?, deleted, id }
 *
 * Without DATABASE_URL every call returns { localOnly: true, ... } and the
 * frontend keeps favorites in localStorage. With a DB, rows are keyed by
 * the session id (a User row is auto-created with id = session id).
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { FavoriteBodySchema } from "@/lib/schemas";
import { apiError } from "@/lib/errors";
import { db, hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "lf_sid";
const ONE_YEAR_SEC = 365 * 24 * 60 * 60;

function getSessionId(req: NextRequest): { sid: string; isNew: boolean } {
  const existing = req.cookies.get(SESSION_COOKIE)?.value;
  if (existing) return { sid: existing, isNew: false };
  return { sid: `anon_${randomUUID().replace(/-/g, "")}`, isNew: true };
}

function stampSession(res: NextResponse, sid: string, isNew: boolean): NextResponse {
  if (isNew) {
    res.cookies.set(SESSION_COOKIE, sid, {
      httpOnly: true,
      path: "/",
      maxAge: ONE_YEAR_SEC,
      sameSite: "lax",
    });
  }
  return res;
}

async function ensureUser(prisma: any, sid: string): Promise<void> {
  await prisma.user.upsert({
    where: { id: sid },
    update: {},
    create: { id: sid },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { sid, isNew } = getSessionId(req);

  if (!hasDatabase()) {
    return stampSession(
      NextResponse.json({ localOnly: true, favorites: [] }),
      sid,
      isNew
    );
  }

  const prisma = await db();
  if (!prisma) {
    return stampSession(
      NextResponse.json({ localOnly: true, favorites: [] }),
      sid,
      isNew
    );
  }

  try {
    await ensureUser(prisma, sid);
    const favorites = await prisma.favorite.findMany({
      where: { userId: sid },
      orderBy: { createdAt: "desc" },
    });
    return stampSession(
      NextResponse.json({ localOnly: false, favorites }),
      sid,
      isNew
    );
  } catch {
    return stampSession(
      NextResponse.json({ localOnly: true, favorites: [] }),
      sid,
      isNew
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { sid, isNew } = getSessionId(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = FavoriteBodySchema.safeParse(body);
  if (!parsed.success) {
    return stampSession(
      apiError("INVALID_INPUT", "Check your search and try again", 400),
      sid,
      isNew
    );
  }
  const { place } = parsed.data;

  if (!hasDatabase()) {
    return stampSession(NextResponse.json({ localOnly: true }), sid, isNew);
  }
  const prisma = await db();
  if (!prisma) {
    return stampSession(NextResponse.json({ localOnly: true }), sid, isNew);
  }

  try {
    await ensureUser(prisma, sid);
    const favorite = await prisma.favorite.upsert({
      where: { userId_placeId: { userId: sid, placeId: place.id } },
      update: {
        name: place.name,
        address: place.address ?? null,
        lat: place.lat,
        lng: place.lng,
        rating: place.rating ?? null,
      },
      create: {
        userId: sid,
        placeId: place.id,
        name: place.name,
        address: place.address ?? null,
        lat: place.lat,
        lng: place.lng,
        rating: place.rating ?? null,
      },
    });
    return stampSession(
      NextResponse.json({ localOnly: false, favorite }),
      sid,
      isNew
    );
  } catch {
    return stampSession(
      apiError("UPSTREAM_ERROR", "Couldn't save the favorite", 502),
      sid,
      isNew
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { sid, isNew } = getSessionId(req);
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return stampSession(
      apiError("INVALID_INPUT", "Missing favorite id", 400),
      sid,
      isNew
    );
  }

  if (!hasDatabase()) {
    return stampSession(
      NextResponse.json({ localOnly: true, deleted: false, id }),
      sid,
      isNew
    );
  }
  const prisma = await db();
  if (!prisma) {
    return stampSession(
      NextResponse.json({ localOnly: true, deleted: false, id }),
      sid,
      isNew
    );
  }

  try {
    await prisma.favorite.deleteMany({ where: { userId: sid, placeId: id } });
    return stampSession(
      NextResponse.json({ localOnly: false, deleted: true, id }),
      sid,
      isNew
    );
  } catch {
    return stampSession(
      apiError("UPSTREAM_ERROR", "Couldn't remove the favorite", 502),
      sid,
      isNew
    );
  }
}
