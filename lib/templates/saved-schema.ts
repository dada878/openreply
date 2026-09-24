import { z } from "zod";

const message = z.string().max(1000);
const destination = z.union([z.url(), z.literal("")]);

// A template contains editable workflow settings only. Account/post bindings,
// active state, tracking slugs and analytics never belong in a reusable flow.
export const templateConfigSchema = z
  .object({
    version: z.literal(1),
    triggerScope: z.enum(["specific", "any", "next"]),
    keywords: z.array(z.string().trim().min(1).max(50)).max(10),
    matchAnyWord: z.boolean(),
    dmTriggerEnabled: z.boolean(),
    // Keep old saved templates compatible; campaigns default to private replies.
    commentDmEnabled: z.boolean().optional(),
    wholeWordMatch: z.boolean(),
    dmMessage: message,
    openingDmEnabled: z.boolean(),
    openingDmMessage: message,
    openingDmButtonLabel: z.string().max(64),
    publicReplyEnabled: z.boolean(),
    publicReplyMessages: z.array(message).max(10),
    aiPublicReplyEnabled: z.boolean().optional(),
    aiPublicReplyPrompt: z.string().max(2000).optional(),
    aiPublicReplyModel: z.string().max(80).optional(),
    trackedDestinationUrl: destination,
    trackingParamKeys: z.array(z.enum(["account_name", "account_id", "campaign_id", "event_id", "video_id", "commenter_id"])).max(6).optional(),
    trackingEventId: z.string().max(120).optional(),
    linkButtonLabel: z.string().max(20),
    secondaryDestinationUrl: destination,
    secondaryButtonLabel: z.string().max(20),
    requireFollow: z.boolean(),
    followPromptMessage: message,
    followPromptButtonLabel: z.string().max(20),
    followCheckFailedMessage: message.default(""),
    collectEmail: z.boolean().default(false),
    emailPromptMessage: message.default(""),
    emailInvalidMessage: message.default(""),
    followUpEnabled: z.boolean(),
    followUpMessage: message,
    followUpDestinationUrl: destination.default(""),
    followUpButtonLabel: z.string().max(20).default(""),
    followUpDelayMinutes: z.number().int().min(0).max(1440),
  })
  .refine((value) => value.matchAnyWord || value.keywords.length > 0, {
    message: "Add at least one keyword, or switch to any word.",
    path: ["keywords"],
  })
  .refine(
    (value) =>
      !value.openingDmEnabled ||
      (value.openingDmMessage.trim().length > 0 &&
        value.openingDmButtonLabel.trim().length > 0),
    {
      message: "Your opening DM needs a message and a button label.",
      path: ["openingDmMessage"],
    },
  )
  .refine(
    (value) =>
      (value.commentDmEnabled === false && !value.dmTriggerEnabled) ||
      value.dmMessage.trim().length > 0,
    {
      message: "Add a DM message when private replies are enabled.",
      path: ["dmMessage"],
    },
  );

export const campaignTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  config: templateConfigSchema,
});

export type TemplateConfig = z.infer<typeof templateConfigSchema>;
export type SavedCampaignTemplate = z.infer<typeof campaignTemplateSchema> & {
  id: string;
};
