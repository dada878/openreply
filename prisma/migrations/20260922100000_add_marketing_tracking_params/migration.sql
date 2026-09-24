ALTER TABLE "Automation"
  ADD COLUMN "trackingParamKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "trackingEventId" TEXT;
