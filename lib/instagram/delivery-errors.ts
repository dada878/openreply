import {
  MetaApiError,
  RateLimitError,
  TokenExpiredError,
} from "@/lib/meta/client";
import {
  ZernioApiError,
  ZernioDeliveryUnconfirmedError,
} from "@/lib/zernio/client";

export class DeliveryUnconfirmedError extends Error {
  constructor(error: unknown) {
    const detail =
      error instanceof Error ? error.message : "Unknown send outcome";
    super(
      `Message delivery is unconfirmed; automatic retries stopped. Inspect the Instagram inbox before retrying. ${detail}`,
    );
    this.name = "DeliveryUnconfirmedError";
  }
}

export function isDeliveryUnconfirmed(
  error: unknown,
): error is DeliveryUnconfirmedError | ZernioDeliveryUnconfirmedError {
  return (
    error instanceof DeliveryUnconfirmedError ||
    error instanceof ZernioDeliveryUnconfirmedError
  );
}

/**
 * Meta uses Graph error 368 for a policy or abuse block. It is represented by
 * RateLimitError for historical compatibility, but unlike a normal 429/4/17
 * throttle it must not be retried automatically.
 */
export function isMetaPolicyBlock(error: unknown): boolean {
  return (
    error instanceof RateLimitError &&
    /\[code=368\b/.test(error.message)
  );
}

export function shouldStopAutomaticRetry(error: unknown): boolean {
  return isDeliveryUnconfirmed(error) || isMetaPolicyBlock(error);
}

// Only explicit rejections prove that no message was delivered. Meta code 1,
// network failures, invalid responses and local persistence failures do not.
export function isConfirmedSendRejection(error: unknown): boolean {
  if (error instanceof RateLimitError || error instanceof TokenExpiredError)
    return true;
  if (error instanceof ZernioApiError)
    return error.code >= 400 && error.code < 500;
  return (
    error instanceof MetaApiError && [10, 100, 200, 551].includes(error.code)
  );
}

export function classifySendError(error: unknown): unknown {
  return isDeliveryUnconfirmed(error) || isConfirmedSendRejection(error)
    ? error
    : new DeliveryUnconfirmedError(error);
}

// Old workers logged these uncertain Meta responses as retryable failures.
export function hasLegacyUnconfirmedDelivery(
  error: string | null | undefined,
): boolean {
  return Boolean(
    error &&
    /(?:MetaApiError (?:1|2|5\d\d):|\[code=(?:1|2|5\d\d)\b)/.test(error),
  );
}
