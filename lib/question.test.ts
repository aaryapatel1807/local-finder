import { describe, expect, it } from "vitest";
import { isQuestionLike } from "./question";

describe("isQuestionLike", () => {
  it("detects leading interrogatives, case-insensitive", () => {
    expect(isQuestionLike("What's the best pharmacy near me")).toBe(true);
    expect(isQuestionLike("WHERE is the nearest ATM")).toBe(true);
    expect(isQuestionLike("which chai places are open late")).toBe(true);
    expect(isQuestionLike("How do I find a 24h clinic")).toBe(true);
    expect(isQuestionLike("is there a petrol pump nearby")).toBe(true);
    expect(isQuestionLike("Are there book stores open now")).toBe(true);
    expect(isQuestionLike("can you find a gym near me")).toBe(true);
    expect(isQuestionLike("does this pharmacy deliver")).toBe(true);
  });

  it("detects a trailing question mark", () => {
    expect(isQuestionLike("best hospital near me?")).toBe(true);
    expect(isQuestionLike("chai?")).toBe(true);
  });

  it("rejects plain keyword queries", () => {
    expect(isQuestionLike("pharmacy")).toBe(false);
    expect(isQuestionLike("chai near fatehgunj")).toBe(false);
    expect(isQuestionLike("")).toBe(false);
    expect(isQuestionLike("   ")).toBe(false);
  });

  it("does not match interrogatives mid-sentence", () => {
    expect(isQuestionLike("places where dogs are allowed")).toBe(false);
  });
});
