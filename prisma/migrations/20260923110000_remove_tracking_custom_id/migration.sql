-- Custom tracking IDs are removed in favor of connected account and campaign
-- context, which are generated automatically and stay consistent.
ALTER TABLE "Automation" DROP COLUMN IF EXISTS "trackingCustomId";
