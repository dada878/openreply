-- Preserve the post that caused a follow gate so any-post campaigns can be
-- attributed to the actual content that generated the conversion.
ALTER TABLE "FollowConversion" ADD COLUMN "sourcePostId" TEXT;

CREATE INDEX "FollowConversion_instagramAccountId_sourcePostId_idx"
  ON "FollowConversion"("instagramAccountId", "sourcePostId");
