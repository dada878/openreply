-- Make the gate retry messages configurable and let follow-up messages include
-- one optional destination button.
ALTER TABLE "Automation"
  ADD COLUMN "emailInvalidMessage" TEXT,
  ADD COLUMN "followCheckFailedMessage" TEXT,
  ADD COLUMN "followUpDestinationUrl" TEXT,
  ADD COLUMN "followUpButtonLabel" TEXT;
