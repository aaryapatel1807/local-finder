/**
 * Lazy Prisma client singleton.
 *
 * Returns null when DATABASE_URL is missing OR when @prisma/client can't be
 * loaded (e.g. `prisma generate` never ran). All callers must treat null as
 * "no database" — the app runs fully without one.
 *
 * The client is dynamically imported inside db() so that importing this
 * module never breaks the build when the generated client is absent.
 */

type PrismaClientLike = any;

let client: PrismaClientLike | null = null;
let attempted = false;

export async function db(): Promise<PrismaClientLike | null> {
  if (attempted) return client;
  attempted = true;

  if (!process.env.DATABASE_URL) return null;

  try {
    // Dynamic import keeps the build green without a generated client.
    const mod = await import("@prisma/client");
    const PrismaClient = (mod as { PrismaClient?: new () => PrismaClientLike })
      .PrismaClient;
    if (!PrismaClient) return null;
    client = new PrismaClient();
    return client;
  } catch {
    client = null;
    return null;
  }
}

/** True when a database is configured (used to decide localOnly mode). */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
