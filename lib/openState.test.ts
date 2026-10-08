import { describe, expect, it } from "vitest";
import { parseOpenState, parseClosingMinutes } from "./openState";

/** Local-time clock helper: new Date(2026, 9, 8, 20, 0) = Oct 8 2026, 8 pm. */
const at = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0);

describe("parseOpenState", () => {
  it('parses "Open ⋅ Closes 11 pm" as open, not closing soon (1h away)', () => {
    const s = parseOpenState("Open ⋅ Closes 11 pm", at(20));
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(false);
    expect(s.label).toBe("Open ⋅ Closes 11 pm");
  });

  it("marks closesSoon when the closing time is within 30 minutes", () => {
    const s = parseOpenState("Open ⋅ Closes 9:30 pm", at(21, 10));
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(true);
  });

  it("does not mark closesSoon when the closing time is far away", () => {
    const s = parseOpenState("Open ⋅ Closes 9:30 pm", at(18));
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(false);
  });

  it('treats "Open 24 hours" as open and never closing soon', () => {
    const s = parseOpenState("Open 24 hours", at(3));
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(false);
  });

  it('treats "Open ⋅ Closes soon" as open and closing soon', () => {
    const s = parseOpenState("Open ⋅ Closes soon", at(20));
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(true);
  });

  it('parses "Closed ⋅ Opens 9 am" as closed', () => {
    const s = parseOpenState("Closed ⋅ Opens 9 am", at(20));
    expect(s.isOpen).toBe(false);
    expect(s.closesSoon).toBe(false);
    expect(s.label).toBe("Closed ⋅ Opens 9 am");
  });

  it('treats "Permanently closed" as closed', () => {
    const s = parseOpenState("Permanently closed", at(12));
    expect(s.isOpen).toBe(false);
    expect(s.closesSoon).toBe(false);
  });

  it('treats "Temporarily closed" as closed', () => {
    const s = parseOpenState("Temporarily closed", at(12));
    expect(s.isOpen).toBe(false);
  });

  it("returns unknown for missing/empty input", () => {
    for (const input of [undefined, null, "", "   "]) {
      const s = parseOpenState(input, at(12));
      expect(s.isOpen).toBeNull();
      expect(s.closesSoon).toBe(false);
      expect(s.label).toBe("Hours unknown");
    }
  });

  it('handles "Closes 12:05 am" near midnight as closing within 30 min', () => {
    // 11:50 pm, closes 12:05 am -> 15 min away (midnight crossing).
    const s = parseOpenState("Open ⋅ Closes 12:05 am", at(23, 50));
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(true);
  });

  it('treats unparseable "Open ⋅ Closes late" as open, not closing soon', () => {
    const s = parseOpenState("Open ⋅ Closes late", at(20));
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(false);
  });

  it("is case-tolerant", () => {
    expect(parseOpenState("open 24 hours", at(12)).isOpen).toBe(true);
    expect(parseOpenState("CLOSED ⋅ Opens 9 am", at(12)).isOpen).toBe(false);
  });
});

describe("parseClosingMinutes", () => {
  it("parses 12h and 24h times", () => {
    expect(parseClosingMinutes("Open ⋅ Closes 11 pm", at(20))).toBe(180);
    expect(parseClosingMinutes("Open ⋅ Closes 9:30 pm", at(21))).toBe(30);
    expect(parseClosingMinutes("Open ⋅ Closes 21:30", at(21))).toBe(30);
  });

  it("handles 12 am / 12 pm correctly", () => {
    // Closes 12 pm read at 11 am -> 60 min.
    expect(parseClosingMinutes("Open ⋅ Closes 12 pm", at(11))).toBe(60);
    // Closes 12 am read at 11 pm -> crosses midnight -> 60 min.
    expect(parseClosingMinutes("Open ⋅ Closes 12 am", at(23))).toBe(60);
  });

  it("returns null when no time is present", () => {
    expect(parseClosingMinutes("Open 24 hours", at(12))).toBeNull();
    expect(parseClosingMinutes("Open ⋅ Closes soon", at(12))).toBeNull();
  });
});
