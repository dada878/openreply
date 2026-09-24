-- Record follows verified by OpenReply's follow gate so they can be
-- attributed to the campaign and post that requested the follow.
CREATE TABLE "FollowConversion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "automationId" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "commenterId" TEXT NOT NULL,
  "commenterName" TEXT,
  "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FollowConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FollowConversion_automationId_commenterId_key"
  ON "FollowConversion"("automationId", "commenterId");
CREATE INDEX "FollowConversion_workspaceId_followedAt_idx"
  ON "FollowConversion"("workspaceId", "followedAt");
CREATE INDEX "FollowConversion_instagramAccountId_commenterId_idx"
  ON "FollowConversion"("instagramAccountId", "commenterId");

ALTER TABLE "FollowConversion"
  ADD CONSTRAINT "FollowConversion_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FollowConversion_automationId_fkey"
    FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "FollowConversion_instagramAccountId_fkey"
    FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
