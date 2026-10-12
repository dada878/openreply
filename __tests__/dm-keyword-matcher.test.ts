import { describe, expect, it } from "vitest";
import { dmKeywordsMayOverlap, matchDmKeywords } from "@/lib/utils/dm-keyword-matcher";

describe("DM keyword matching", () => {
  it("matches the full message after trimming outer spaces and ignoring case", () => {
    expect(matchDmKeywords("  aI  ", ["AI"], "EXACT")).toEqual({
      matched: true,
      matchedKeyword: "AI",
    });
    expect(matchDmKeywords("I said AI", ["AI"], "EXACT").matched).toBe(false);
  });

  it("uses a substring only in contains mode", () => {
    expect(matchDmKeywords("Please send AI details", ["AI"], "CONTAINS").matched).toBe(true);
    expect(matchDmKeywords("Please send AI details", ["AI"], "EXACT").matched).toBe(false);
  });

  it("accepts edit distance below 10 and rejects distance 10 or more", () => {
    expect(matchDmKeywords("cat", ["cut"], "FUZZY").matched).toBe(true);
    expect(matchDmKeywords("abcdefghij", ["x"], "FUZZY").matched).toBe(false);
  });

  it("warns when active campaign rules can overlap", () => {
    expect(dmKeywordsMayOverlap(["AI"], "CONTAINS", ["AI剪輯"], "EXACT")).toBe(true);
    expect(dmKeywordsMayOverlap(["GUIDE"], "EXACT", ["PRICE"], "EXACT")).toBe(false);
  });
});
