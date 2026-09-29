import { z } from "zod";

export const promotionVariantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1000),
  destinationUrl: z
    .union([
      z
        .string()
        .url()
        .refine((value) => /^https?:\/\//i.test(value)),
      z.literal(""),
    ])
    .default(""),
  buttonLabel: z.string().trim().max(20).default(""),
});
export const followUpSchema = z.object({
  name: z.string().trim().min(1).max(100),
  variants: z.array(promotionVariantSchema).min(1).max(10),
  selectionMode: z.enum(["RANDOM", "SEQUENTIAL"]).default("RANDOM"),
  allowRepeat: z.boolean().default(false),
  delayMinutes: z.number().int().min(1).max(1440).default(3),
  isActive: z.boolean().default(false),
});
export type FollowUpSettings = z.infer<typeof followUpSchema>;
