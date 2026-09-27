ALTER TABLE "DmLog"
  ADD COLUMN "commenterDisplayName" TEXT,
  ADD COLUMN "commentCreatedAt" TIMESTAMP(3),
  ADD COLUMN "commentLikeCount" INTEGER,
  ADD COLUMN "aiPublicReplyInput" TEXT,
  ADD COLUMN "aiPublicReplyOutput" TEXT,
  ADD COLUMN "aiPublicReplyModel" TEXT;

CREATE INDEX "DmLog_automationId_aiPublicReplyOutput_idx"
  ON "DmLog"("automationId", "aiPublicReplyOutput");
