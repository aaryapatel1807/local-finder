import { describe, expect, it } from "vitest";
import { canonicalKey, normalizeQueryText, detectEmergencyIntent } from "./canonical";

describe("normalizeQueryText", () => {
  it("lowercases, strips punctuation, collapses spaces", () => {
    expect(normalizeQueryText("  Medical-Store!! ")).toBe("medical store");
    expect(normalizeQueryText("BEST   chai")).toBe("best chai");
  });
});

describe("canonicalKey", () => {
  it("maps the documented variants to pharmacy", () => {
    for (const q of ["medical store", "davakhana", "pharmasy", "chemist"]) {
      expect(canonicalKey(q)).toBe("pharmacy");
    }
  });

  it("maps chai variants", () => {
    expect(canonicalKey("chai")).toBe("chai");
    expect(canonicalKey("tea stall")).toBe("chai");
    expect(canonicalKey("best chai")).toBe("chai");
  });

  it("maps the other chips", () => {
    expect(canonicalKey("ATM")).toBe("atm");
    expect(canonicalKey("petrol pump")).toBe("petrol");
    expect(canonicalKey("gas station")).toBe("petrol");
    expect(canonicalKey("kirana")).toBe("groceries");
    expect(canonicalKey("restorent")).toBe("restaurant");
    expect(canonicalKey("hosptial")).toBe("hospital");
    expect(canonicalKey("bike repair")).toBe("mechanic");
  });

  it("uses whole-word matching (riverbank is not a bank)", () => {
    expect(canonicalKey("riverbank")).toBe("riverbank");
    expect(canonicalKey("the bank nearby")).toBe("bank");
  });

  it("returns normalized input unchanged when nothing matches", () => {
    expect(canonicalKey("cheap veg place open late")).toBe(
      "cheap veg place open late"
    );
    expect(canonicalKey("  ")).toBe("");
  });

  it("prefers the longest alias", () => {
    expect(canonicalKey("medical store")).toBe("pharmacy");
    expect(canonicalKey("chai tapri")).toBe("chai");
  });
});

describe("detectEmergencyIntent", () => {
  it("maps 'fever at 11pm' to pharmacy", () => {
    expect(detectEmergencyIntent("fever at 11pm")).toBe("pharmacy");
  });

  it("maps 'bike puncture' to mechanic", () => {
    expect(detectEmergencyIntent("bike puncture")).toBe("mechanic");
  });

  it("maps 'flat tyre' to mechanic", () => {
    expect(detectEmergencyIntent("I have a flat tyre")).toBe("mechanic");
  });

  it("returns null for non-emergency queries", () => {
    expect(detectEmergencyIntent("best chai near me")).toBeNull();
    expect(detectEmergencyIntent("pharmacy")).toBeNull();
    expect(detectEmergencyIntent("")).toBeNull();
  });

  it("does not false-positive on substrings", () => {
    expect(detectEmergencyIntent("feverfew tea")).toBeNull();
  });
});
