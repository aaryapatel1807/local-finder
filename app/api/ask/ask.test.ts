/**
 * API tests for POST /api/ask.
 * AI is disabled in this environment, so the route degrades gracefully;
 * the Groq-dependent answer path is covered by lib/ai.test.ts instead.
 * Mock mode (USE_MOCK=true) supplies the review snippets — no SerpApi.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { askCacheKey, clearMemoryCache } from "@/lib/cache";
import { clearRateLimits } from "@/lib/ratelimit";

process.env.USE_MOCK = "true";

let ipCounter = 300;
function askRequest(body: unknown): NextRequest {
  ipCounter += 1;
  return new NextRequest("http://localhost/api/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.3.0.${ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

const VALID = {
  dataId: "0x395fda7d1a2b3c01:0xaa11bb22cc33dd44",
  placeName: "Sunrise Medical",
  question: "is it open late?",
};

beforeEach(() => {
  clearMemoryCache();
  clearRateLimits();
  vi.stubEnv("GROQ_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("askCacheKey", () => {
  it("hashes dataId + normalized question deterministically", () => {
    expect(askCacheKey("abc", "Is it open late?")).toBe(
      askCacheKey("abc", "  is it OPEN late? ")
    );
    expect(askCacheKey("abc", "is it open late?")).not.toBe(
      askCacheKey("def", "is it open late?")
    );
    expect(askCacheKey("abc", "is it open late?")).toMatch(/^ask:[0-9a-f]{32}$/);
  });
});

describe("POST /api/ask", () => {
  it("returns { answer: null } when AI is disabled (never 500)", async () => {
    const res = await POST(askRequest(VALID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { answer: unknown };
    expect(json.answer).toBeNull();
  });

  it("returns { answer: null, basedOn: 0 } when dataId is absent", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test"); // AI on, but no reviews to consult
    const res = await POST(
      askRequest({ placeName: "X", question: "is it clean?" })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { answer: unknown; basedOn: number };
    expect(json.answer).toBeNull();
    expect(json.basedOn).toBe(0);
  });

  it("rejects invalid bodies with 400 INVALID_INPUT", async () => {
    for (const body of [
      {},
      { ...VALID, question: "" },
      { ...VALID, placeName: "" },
      { ...VALID, question: "x".repeat(301) },
      { ...VALID, placeName: "x".repeat(121) },
    ]) {
      const res = await POST(askRequest(body));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("INVALID_INPUT");
    }
  });
});
