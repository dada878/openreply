import { describe, expect, it } from "vitest";
import { appendMarketingTrackingParams } from "../lib/tracking/marketing-params";

describe("marketing tracking parameters", () => {
  it("adds only enabled values and preserves destination parameters", () => {
    const result = appendMarketingTrackingParams("https://example.com/offer?utm_source=ig", {
      keys: ["account_name", "campaign_id", "commenter_id"],
      accountName: "dada._.878",
      campaignId: "cmp_123",
      commenterId: "user_456",
      eventId: "should-not-be-included",
    });

    expect(result).toBe(
      "https://example.com/offer?utm_source=ig&or_account_name=dada._.878&or_campaign_id=cmp_123&or_commenter_id=user_456",
    );
  });

  it("ignores empty values and malformed destinations", () => {
    expect(
      appendMarketingTrackingParams("not a url", {
        keys: ["account_id"],
        accountId: "account_123",
      }),
    ).toBe("not a url");
  });
});
