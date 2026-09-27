CREATE TABLE "InstagramCredential" (
  "id" TEXT NOT NULL,
  "instagramAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "appId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "tokenFingerprint" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstagramCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstagramCredential_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InstagramCredential_instagramAccountId_tokenFingerprint_key" ON "InstagramCredential"("instagramAccountId", "tokenFingerprint");
CREATE INDEX "InstagramCredential_instagramAccountId_idx" ON "InstagramCredential"("instagramAccountId");
ALTER TABLE "Automation" ADD COLUMN "instagramCredentialId" TEXT;
CREATE INDEX "Automation_instagramCredentialId_idx" ON "Automation"("instagramCredentialId");
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_instagramCredentialId_fkey" FOREIGN KEY ("instagramCredentialId") REFERENCES "InstagramCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
