export const MARKETING_TRACKING_PARAMS = [
  { key: "account_name", query: "or_account_name", label: "Instagram 帳號名稱" },
  { key: "account_id", query: "or_account_id", label: "Instagram 帳號 ID" },
  { key: "campaign_id", query: "or_campaign_id", label: "OpenReply 活動 ID" },
  { key: "event_id", query: "or_event_id", label: "自訂事件 ID" },
  { key: "video_id", query: "or_video_id", label: "貼文／影片 ID" },
  { key: "commenter_id", query: "or_commenter_id", label: "留言者 ID（辨識個別使用者）" },
] as const;

export type MarketingTrackingKey = (typeof MARKETING_TRACKING_PARAMS)[number]["key"];

export type MarketingTrackingContext = {
  keys?: readonly string[];
  accountName?: string | null;
  accountId?: string | null;
  campaignId?: string | null;
  eventId?: string | null;
  videoId?: string | null;
  commenterId?: string | null;
};

const values: Record<MarketingTrackingKey, keyof MarketingTrackingContext> = {
  account_name: "accountName",
  account_id: "accountId",
  campaign_id: "campaignId",
  event_id: "eventId",
  video_id: "videoId",
  commenter_id: "commenterId",
};

export function appendMarketingTrackingParams(
  rawUrl: string,
  context: MarketingTrackingContext | undefined,
) {
  if (!context?.keys?.length) return rawUrl;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  for (const definition of MARKETING_TRACKING_PARAMS) {
    if (!context.keys.includes(definition.key)) continue;
    const value = context[values[definition.key]];
    if (typeof value === "string" && value.trim()) {
      url.searchParams.set(definition.query, value.trim());
    }
  }
  return url.toString();
}
