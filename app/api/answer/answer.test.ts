/**
 * API tests for POST /api/answer.
 * AI is disabled in this environment, so the route degrades gracefully;
 * the Groq-dependent happy path is covered by lib/ai.test.ts instead.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { clearMemoryCache } from "@/lib/cache";
import { clearRateLimits } from "@/lib/ratelimit";

process.env.USE_MOCK = "true";

let ipCounter = 200;
function answerRequest(body: unknown): NextRequest {
  ipCounter += 1;
  return new NextRequest("http://localhost/api/answer", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.2.0.${ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

const VALID = {
  text: "best pharmacy near me",
  lat: 22.3072,
  lng: 73.1812,
  radiusKm: 3,
};

beforeEach(() => {
  clearMemoryCache();
  clearRateLimits();
  vi.stubEnv("GROQ_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/answer", () => {
  it("returns { answer: null, aiDisabled: true } when AI is disabled", async () => {
    const res = await POST(answerRequest(VALID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      answer: unknown;
      aiDisabled?: boolean;
    };
    expect(json.answer).toBeNull();
    expect(json.aiDisabled).toBe(true);
  });

  it("rejects invalid bodies with 400 INVALID_INPUT", async () => {
    for (const body of [
      {},
      { ...VALID, text: "" },
      { ...VALID, lat: 200 },
      { ...VALID, radiusKm: 7 },
      { ...VALID, text: "x".repeat(301) },
    ]) {
      const res = await POST(answerRequest(body));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("INVALID_INPUT");
    }
  });
});
