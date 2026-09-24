CREATE TABLE "AiConnection" (
  "workspaceId" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "defaultModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiConnection_pkey" PRIMARY KEY ("workspaceId"),
  CONSTRAINT "AiConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
