export {
  MetaApiError,
  RateLimitError,
  TokenExpiredError,
  PermissionError,
} from "@/lib/meta/client";
export type {
  InstagramComment,
  InstagramMedia,
  InstagramMediaInsights,
  FollowerCountPoint,
  LinkButton,
} from "@/lib/meta/client";
export * from "./context";
export * from "./send-messages";
export * from "./read-content";
export * from "./read-inbox";
export * from "./read-analytics";

export async function getRecipientProfile({
  context,
  recipientId,
}: {
  context: import("./context").InstagramContext;
  recipientId: string;
}): Promise<{ username?: string; name?: string } | null> {
  if (context.provider === "META") {
    return (await import("@/lib/meta/client")).getRecipientProfile(
      context.accessToken,
      recipientId,
    );
  }
  // Zernio does not expose a stable recipient-profile endpoint. The webhook's
  // username remains the reliable fallback for AI context.
  return null;
}
