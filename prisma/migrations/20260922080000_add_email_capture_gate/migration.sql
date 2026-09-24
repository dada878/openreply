-- Add an email gate to an existing campaign without changing current campaigns.
ALTER TABLE "Automation"
  ADD COLUMN "collectEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailPromptMessage" TEXT;

CREATE TABLE "EmailCapture" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "commenterId" TEXT NOT NULL,
  "commenterName" TEXT,
  "email" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "capturedAt" TIMESTAMP(3),
  "emailPromptClaimedAt" TIMESTAMP(3),
  "emailPromptSentAt" TIMESTAMP(3),
  "emailPromptDeliveryUnconfirmed" BOOLEAN NOT NULL DEFAULT false,
  "contentDeliveryClaimedAt" TIMESTAMP(3),
  "contentDeliveredAt" TIMESTAMP(3),
  "contentDeliveryUnconfirmed" BOOLEAN NOT NULL DEFAULT false,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailCapture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailCapture_automationId_commenterId_key"
  ON "EmailCapture"("automationId", "commenterId");
CREATE INDEX "EmailCapture_workspaceId_capturedAt_idx"
  ON "EmailCapture"("workspaceId", "capturedAt");
CREATE INDEX "EmailCapture_instagramAccountId_commenterId_idx"
  ON "EmailCapture"("instagramAccountId", "commenterId");

ALTER TABLE "EmailCapture"
  ADD CONSTRAINT "EmailCapture_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EmailCapture_automationId_fkey"
    FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EmailCapture_instagramAccountId_fkey"
    FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
