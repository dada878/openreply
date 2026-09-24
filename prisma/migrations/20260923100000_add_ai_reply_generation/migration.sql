-- Let campaigns optionally generate their public comment reply from an AI prompt.
ALTER TABLE "Automation"
  ADD COLUMN "aiPublicReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiPublicReplyPrompt" TEXT;
