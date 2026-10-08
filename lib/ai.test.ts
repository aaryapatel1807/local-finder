import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isAiEnabled,
  parseQuery,
  parseFallback,
  summarizeReviews,
} from "./ai";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isAiEnabled", () => {
  it("is false when GROQ_API_KEY is missing", () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(isAiEnabled()).toBe(false);
  });

  it("is true when GROQ_API_KEY is set", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    expect(isAiEnabled()).toBe(true);
  });
});

describe("parseQuery fallback", () => {
  it("returns the raw text as the query when AI is disabled", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const out = await parseQuery("cheap chai near station");
    expect(out).toEqual({ query: "cheap chai near station", openNow: false, sort: "best" });
  });

  it("falls back to raw text when the Groq call fails", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const out = await parseQuery("pharmacy open late");
    expect(out.query).toBe("pharmacy open late");
    expect(out.openNow).toBe(false);
  });

  it("falls back to raw text when Groq returns invalid JSON", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
      })
    );
    const out = await parseQuery("pharmacy open late");
    expect(out).toEqual(parseFallback("pharmacy open late"));
  });

  it("parses and Zod-validates a good model response", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"query":"vegetarian restaurant","openNow":true,"priceMax":1,"near":"railway station","sort":"best"}',
              },
            },
          ],
        }),
      })
    );
    const out = await parseQuery("cheap veg place open late near station");
    expect(out.query).toBe("vegetarian restaurant");
    expect(out.openNow).toBe(true);
    expect(out.priceMax).toBe(1);
    expect(out.near).toBe("railway station");
    expect(out.sort).toBe("best");
  });
});

describe("summarizeReviews", () => {
  it("throws when AI is disabled so callers hide the feature", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(
      summarizeReviews([{ snippet: "great", rating: 5 }], "X")
    ).rejects.toThrow();
  });

  it("throws when there is no review text", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    await expect(summarizeReviews([], "X")).rejects.toThrow();
  });
});
