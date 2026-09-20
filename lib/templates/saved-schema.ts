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
    wholeWordMatch: z.boolean(),
    dmMessage: message.refine((value) => value.trim().length > 0),
    openingDmEnabled: z.boolean(),
    openingDmMessage: message,
    openingDmButtonLabel: z.string().max(64),
    publicReplyEnabled: z.boolean(),
    publicReplyMessages: z.array(message).max(10),
    trackedDestinationUrl: destination,
    linkButtonLabel: z.string().max(20),
    secondaryDestinationUrl: destination,
    secondaryButtonLabel: z.string().max(20),
    requireFollow: z.boolean(),
    followPromptMessage: message,
    followPromptButtonLabel: z.string().max(20),
    followUpEnabled: z.boolean(),
    followUpMessage: message,
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
  );

export const campaignTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  config: templateConfigSchema,
});

export type TemplateConfig = z.infer<typeof templateConfigSchema>;
export type SavedCampaignTemplate = z.infer<typeof campaignTemplateSchema> & {
  id: string;
};
