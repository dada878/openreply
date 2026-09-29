CREATE TABLE "SharedFollowUp" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
 "name" TEXT NOT NULL, "variants" JSONB NOT NULL, "selectionMode" TEXT NOT NULL DEFAULT 'RANDOM', "allowRepeat" BOOLEAN NOT NULL DEFAULT false,
 "delayMinutes" INTEGER NOT NULL DEFAULT 3 CHECK ("delayMinutes" BETWEEN 1 AND 1440),
 "isActive" BOOLEAN NOT NULL DEFAULT false, "archivedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SharedFollowUp_workspaceId_createdAt_idx" ON "SharedFollowUp"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "SharedFollowUp_one_active_per_workspace" ON "SharedFollowUp"("workspaceId") WHERE "isActive" = true;
CREATE TABLE "SharedFollowUpDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY, "followUpId" TEXT NOT NULL REFERENCES "SharedFollowUp"("id") ON DELETE CASCADE,
 "automationId" TEXT NOT NULL, "instagramAccountId" TEXT NOT NULL, "userId" TEXT NOT NULL, "commenterName" TEXT,
 "dedupeKey" TEXT NOT NULL UNIQUE, "variant" JSONB NOT NULL, "dueAt" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "errorMessage" TEXT, "sentAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SharedFollowUpDelivery_followUpId_instagramAccountId_userId_idx" ON "SharedFollowUpDelivery"("followUpId", "instagramAccountId", "userId");
CREATE INDEX "SharedFollowUpDelivery_status_dueAt_idx" ON "SharedFollowUpDelivery"("status", "dueAt");
