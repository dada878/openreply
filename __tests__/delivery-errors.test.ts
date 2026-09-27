import { describe, expect, it } from "vitest";
import { MetaApiError, RateLimitError } from "@/lib/meta/client";
import {
  isMetaPolicyBlock,
  isMetaPolicyBlockMessage,
  shouldStopAutomaticRetry,
} from "@/lib/instagram/delivery-errors";

describe("Meta policy-block delivery errors", () => {
  it("stops retries for Graph code 368", () => {
    const error = new RateLimitError(
      "The action attempted has been deemed abusive or is otherwise disallowed [code=368 sub=4928002]",
    );
    expect(isMetaPolicyBlock(error)).toBe(true);
    expect(shouldStopAutomaticRetry(error)).toBe(true);
  });

  it("keeps ordinary throttles retryable", () => {
    const error = new RateLimitError("temporary provider throttle");
    expect(isMetaPolicyBlock(error)).toBe(false);
    expect(shouldStopAutomaticRetry(error)).toBe(false);
  });

  it("does not classify unrelated Meta errors as policy blocks", () => {
    expect(
      isMetaPolicyBlock(new MetaApiError(100, undefined, undefined, "Invalid parameter")),
    ).toBe(false);
  });

  it("recognizes persisted policy-block messages for backlog release", () => {
    expect(isMetaPolicyBlockMessage("Meta 368 [code=368 sub=4928002]")).toBe(true);
    expect(isMetaPolicyBlockMessage("temporary provider throttle")).toBe(false);
  });
});
