CREATE TABLE "CampaignTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignTemplate_workspaceId_updatedAt_idx" ON "CampaignTemplate"("workspaceId", "updatedAt");

ALTER TABLE "CampaignTemplate" ADD CONSTRAINT "CampaignTemplate_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
