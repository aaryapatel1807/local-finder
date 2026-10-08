/**
 * POST /api/parse: canonicalKey sharing + 24h parse cache.
 * Runs without GROQ_API_KEY (aiDisabled path) — no network.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { clearMemoryCache } from "@/lib/cache";
import { clearRateLimits } from "@/lib/ratelimit";

delete process.env.GROQ_API_KEY;

let ipCounter = 100;
function parseRequest(text: string): NextRequest {
  ipCounter += 1;
  return new NextRequest("http://localhost/api/parse", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.1.0.${ipCounter}`,
    },
    body: JSON.stringify({ text }),
  });
}

beforeEach(() => {
  clearMemoryCache();
  clearRateLimits();
});

describe("POST /api/parse (canonicalKey + cache)", () => {
  it("returns a canonicalKey for variant queries", async () => {
    const res = await POST(parseRequest("davakhana"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      parsed: null;
      canonicalKey: string;
      cached: boolean;
      aiDisabled: boolean;
      fallbackQuery: string;
    };
    expect(json.aiDisabled).toBe(true);
    expect(json.canonicalKey).toBe("pharmacy");
    expect(json.fallbackQuery).toBe("davakhana");
    expect(json.cached).toBe(false);
  });

  it("serves the second identical parse from cache (cached: true)", async () => {
    await POST(parseRequest("medical store"));
    const req = new NextRequest("http://localhost/api/parse", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.1.0.101",
      },
      body: JSON.stringify({ text: "medical store" }),
    });
    const res = await POST(req);
    const json = (await res.json()) as { cached: boolean; canonicalKey: string };
    expect(json.cached).toBe(true);
    expect(json.canonicalKey).toBe("pharmacy");
  });

  it("canonicalizes through the fallback query when AI is disabled", async () => {
    const res = await POST(parseRequest("best chai"));
    const json = (await res.json()) as { canonicalKey: string };
    expect(json.canonicalKey).toBe("chai");
  });
});
