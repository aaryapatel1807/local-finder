import { describe, expect, it } from "vitest";
import {
  parseOpenState,
  parseClosingMinutes,
  resolveOpenNow,
  parseHoursValue,
  hoursForDate,
} from "./openState";

/** Local-time clock helper: new Date(2026, 9, 8, 20, 0) = Oct 8 2026, 8 pm. */
const at = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0);
/** Oct 9 2026 is a Friday (for overnight-spill tests). */
const friAt = (h: number, m = 0) => new Date(2026, 9, 9, h, m, 0);

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

describe("resolveOpenNow", () => {
  it('treats "Open 24 hours" weekly hours as open and never closing soon', () => {
    const s = resolveOpenNow(
      { weeklyHours: { Thursday: "Open 24 hours" } },
      at(3)
    );
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(false);
    expect(s.label).toBe("Open 24 hours");
  });

  it("resolves normal hours against the current weekday", () => {
    const hours = { Thursday: "9:00 AM – 11:00 PM" };
    expect(resolveOpenNow({ weeklyHours: hours }, at(20)).isOpen).toBe(true);
    expect(resolveOpenNow({ weeklyHours: hours }, at(20)).closesSoon).toBe(false);
    expect(resolveOpenNow({ weeklyHours: hours }, at(8)).isOpen).toBe(false);
  });

  it("marks closesSoon when weekly hours end within 30 minutes", () => {
    const s = resolveOpenNow(
      { weeklyHours: { Thursday: "9:00 AM – 11:00 PM" } },
      at(22, 40)
    );
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(true);
  });

  it('treats "Closed" weekly hours as closed', () => {
    const s = resolveOpenNow(
      { weeklyHours: { Thursday: "Closed" } },
      at(12)
    );
    expect(s.isOpen).toBe(false);
    expect(s.closesSoon).toBe(false);
  });

  it("handles overnight hours: open late, closed after close", () => {
    const hours = { Thursday: "10:00 AM – 2:00 AM" };
    expect(resolveOpenNow({ weeklyHours: hours }, at(23)).isOpen).toBe(true);
    expect(resolveOpenNow({ weeklyHours: hours }, at(23)).closesSoon).toBe(false);
    // Friday 3 am: past the 2 am close -> closed.
    const fridayClosed = resolveOpenNow({ weeklyHours: hours }, friAt(3));
    expect(fridayClosed.isOpen).toBe(false);
  });

  it("counts yesterday's overnight window spilling past midnight as open", () => {
    // Friday 1 am with only a Thursday overnight entry -> still open.
    const s = resolveOpenNow(
      { weeklyHours: { Thursday: "10:00 AM – 2:00 AM" } },
      friAt(1)
    );
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(false);
    // 1:45 am -> closes within 30 min of 2 am.
    expect(
      resolveOpenNow({ weeklyHours: { Thursday: "10:00 AM – 2:00 AM" } }, friAt(1, 45)).closesSoon
    ).toBe(true);
  });

  it("handles multi-interval days", () => {
    const hours = { Thursday: "9:00 AM – 1:00 PM, 5:00 PM – 9:00 PM" };
    expect(resolveOpenNow({ weeklyHours: hours }, at(10)).isOpen).toBe(true);
    expect(resolveOpenNow({ weeklyHours: hours }, at(18)).isOpen).toBe(true);
    expect(resolveOpenNow({ weeklyHours: hours }, at(14)).isOpen).toBe(false);
  });

  it("matches 3-letter and lowercase day-key variants", () => {
    const s = resolveOpenNow(
      { weeklyHours: { thu: "9:00 AM – 5:00 PM" } },
      at(12)
    );
    expect(s.isOpen).toBe(true);
    const s2 = resolveOpenNow(
      { weeklyHours: { thursday: "9:00 AM – 5:00 PM" } },
      at(12)
    );
    expect(s2.isOpen).toBe(true);
  });

  it("falls back to open_state when weeklyHours is missing", () => {
    const s = resolveOpenNow({ open_state: "Open ⋅ Closes 11 pm" }, at(20));
    expect(s.isOpen).toBe(true);
    expect(s.closesSoon).toBe(false);
    expect(s.label).toBe("Open ⋅ Closes 11 pm");
  });

  it("returns unknown when both weeklyHours and open_state are missing", () => {
    const s = resolveOpenNow({}, at(12));
    expect(s.isOpen).toBeNull();
    expect(s.closesSoon).toBe(false);
    expect(s.label).toBe("Hours unknown");
  });

  it("falls back to open_state when the hours value is unparseable", () => {
    const s = resolveOpenNow(
      { weeklyHours: { Thursday: "whenever, honestly" }, open_state: "Closed ⋅ Opens 9 am" },
      at(20)
    );
    expect(s.isOpen).toBe(false);
    expect(s.label).toBe("Closed ⋅ Opens 9 am");
  });

  it("falls back to open_state when there is no entry for today", () => {
    const s = resolveOpenNow(
      { weeklyHours: { Monday: "9:00 AM – 5:00 PM" }, open_state: "Open ⋅ Closes 11 pm" },
      at(20) // Thursday
    );
    expect(s.isOpen).toBe(true);
  });
});

describe("parseHoursValue", () => {
  it("parses 12h ranges with en dash / hyphen", () => {
    expect(parseHoursValue("10:00 AM – 11:00 PM")).toEqual([
      { open: 600, close: 1380 },
    ]);
    expect(parseHoursValue("9AM-5PM")).toEqual([{ open: 540, close: 1020 }]);
  });

  it("parses 24h values", () => {
    expect(parseHoursValue("Open 24 hours")).toEqual([
      { open: 0, close: 1440 },
    ]);
  });

  it('returns [] for "Closed"', () => {
    expect(parseHoursValue("Closed")).toEqual([]);
  });

  it("returns null for garbage", () => {
    expect(parseHoursValue("whenever, honestly")).toBeNull();
    expect(parseHoursValue("")).toBeNull();
  });
});

describe("hoursForDate", () => {
  it("matches full, 3-letter and lowercase keys", () => {
    expect(hoursForDate({ Thursday: "9–5" }, at(12))).toBe("9–5");
    expect(hoursForDate({ Thu: "9–5" }, at(12))).toBe("9–5");
    expect(hoursForDate({ thursday: "9–5" }, at(12))).toBe("9–5");
    expect(hoursForDate({ Monday: "9–5" }, at(12))).toBeUndefined();
  });
});
