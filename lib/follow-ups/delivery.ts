import { createHash, randomInt } from "node:crypto";
import { promotionVariantSchema } from "./schema";
import { prisma } from "@/lib/db/client";
import { getDMQueue, getRedisConnection } from "@/lib/queue/client";
import {
  createInstagramContext,
  sendDirectMessage,
  sendDirectMessageWithLinkButton,
} from "@/lib/instagram/provider";
import { isConfirmedSendRejection } from "@/lib/instagram/delivery-errors";
import { renderMessageWithoutLink } from "@/lib/tracking/message";
import { appendMarketingTrackingParams } from "@/lib/tracking/marketing-params";
import {
  reserveWorkspaceDMSend,
  releaseWorkspaceDMReservation,
} from "@/lib/billing/usage";

export const SHARED_FOLLOWUP_JOB = "shared-followup";
const WINDOW_MS = 24 * 60 * 60_000;
const windowKey = (accountId: string, userId: string) =>
  `followup-window:${accountId}:${userId}`;

// Only actual inbound DMs/button taps call this; read receipts and comments do not.
export async function recordFollowUpInteraction(
  accountId: string,
  userId: string,
  receivedAt: number,
) {
  if (!Number.isFinite(receivedAt) || receivedAt > Date.now()) return;
  const expiresAt = receivedAt + WINDOW_MS;
  if (expiresAt <= Date.now()) return;
  await getRedisConnection().eval(
    `
    local previous = tonumber(redis.call('GET', KEYS[1]) or '0')
    if tonumber(ARGV[1]) > previous then
      redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
    end
    return 1`,
    1,
    windowKey(accountId, userId),
    expiresAt,
    expiresAt - Date.now(),
  );
}

export async function scheduleSharedFollowUp(input: {
  automation: { id: string; workspaceId: string; instagramAccountId: string };
  userId: string;
  commenterName: string | null;
  sourceKey: string;
}): Promise<boolean> {
  return prisma
    .$transaction(async (tx) => {
      // Use the same lock as settings changes so pausing cannot miss a new delivery.
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${input.automation.workspaceId} FOR UPDATE`;
      const promotion = await tx.sharedFollowUp.findFirst({
        where: {
          workspaceId: input.automation.workspaceId,
          isActive: true,
          archivedAt: null,
        },
      });
      if (!promotion) return false;
      const variants = promotionVariantSchema
        .array()
        .min(1)
        .parse(promotion.variants);
      const recipient = {
        followUpId: promotion.id,
        instagramAccountId: input.automation.instagramAccountId,
        userId: input.userId,
      };
      const dedupeKey = createHash("sha256")
        .update(
          JSON.stringify([
            promotion.id,
            input.automation.instagramAccountId,
            input.userId,
            input.sourceKey,
          ]),
        )
        .digest("hex");
      if (
        await tx.sharedFollowUpDelivery.findUnique({
          where: { dedupeKey },
          select: { id: true },
        })
      )
        return true;
      const previousCount = await tx.sharedFollowUpDelivery.count({
        where: recipient,
      });
      if (!promotion.allowRepeat && previousCount) return true;
      const variant =
        variants[
          promotion.selectionMode === "SEQUENTIAL"
            ? previousCount % variants.length
            : randomInt(variants.length)
        ];
      // Stored before enqueueing; the worker recovers pending rows after a queue outage.
      await tx.sharedFollowUpDelivery.create({
        data: {
          ...recipient,
          automationId: input.automation.id,
          commenterName: input.commenterName,
          dedupeKey,
          variant,
          dueAt: new Date(Date.now() + promotion.delayMinutes * 60_000),
        },
      });
      return true;
    })
    .catch((error) => {
      // Resource delivery has already succeeded. Never make its job resend because
      // scheduling a promotion failed; keep the failure visible in worker logs.
      console.error(
        "[Shared follow-up] Could not schedule",
        input.sourceKey,
        error,
      );
      return true;
    });
}

export async function enqueueDueFollowUps() {
  const rows = await prisma.sharedFollowUpDelivery.findMany({
    where: { status: "PENDING", dueAt: { lte: new Date() } },
    orderBy: { dueAt: "asc" },
    take: 100,
  });
  for (const row of rows)
    await getDMQueue().add(
      SHARED_FOLLOWUP_JOB,
      { deliveryId: row.id },
      {
        jobId: `shared-followup_${row.id}`,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  // A process crash after claiming a send cannot safely be replayed.
  await prisma.sharedFollowUpDelivery.updateMany({
    where: {
      status: "SENDING",
      updatedAt: { lt: new Date(Date.now() - 10 * 60_000) },
    },
    data: {
      status: "UNCONFIRMED",
      errorMessage:
        "Worker stopped before delivery could be confirmed; inspect inbox before resending",
    },
  });
}

export async function processSharedFollowUp(deliveryId: string) {
  const row = await prisma.sharedFollowUpDelivery.findUnique({
    where: { id: deliveryId },
    include: { followUp: true },
  });
  if (!row || row.status !== "PENDING" || row.dueAt.getTime() > Date.now())
    return;
  const automation = await prisma.automation.findFirst({
    where: {
      id: row.automationId,
      workspaceId: row.followUp.workspaceId,
      instagramAccountId: row.instagramAccountId,
      isActive: true,
    },
    include: { instagramAccount: true },
  });
  const setStatus = (status: string, errorMessage: string | null) =>
    prisma.sharedFollowUpDelivery.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status, errorMessage },
    });
  if (!automation || !row.followUp.isActive || row.followUp.archivedAt) {
    await setStatus("CANCELLED", "Promotion or source campaign is inactive");
    return;
  }
  const expiresAt = Number(
    await getRedisConnection().get(
      windowKey(automation.instagramAccount.instagramId, row.userId),
    ),
  );
  if (!expiresAt || Date.now() >= expiresAt - 60_000) {
    await setStatus(
      "SKIPPED_WINDOW",
      "No confirmed inbound DM/button interaction within the messaging window",
    );
    return;
  }
  let context;
  try {
    context = await createInstagramContext(
      automation.instagramAccount,
      row.id,
      automation.instagramCredentialId,
    );
  } catch {
    await setStatus("FAILED", "Instagram connection unavailable");
    return;
  }
  const variant = promotionVariantSchema.parse(row.variant);
  const claimed = await prisma.sharedFollowUpDelivery.updateMany({
    where: { id: row.id, status: "PENDING" },
    data: { status: "SENDING" },
  });
  if (!claimed.count) return;
  let sendStarted = false;
  let reservation:
    Awaited<ReturnType<typeof reserveWorkspaceDMSend>> | undefined;
  try {
    reservation = await reserveWorkspaceDMSend(automation.workspaceId);
    if (!reservation.allowed) {
      await prisma.sharedFollowUpDelivery.update({
        where: { id: row.id },
        data: {
          status: "SKIPPED_LIMIT",
          errorMessage: "Workspace DM quota reached",
        },
      });
      return;
    }
    const message = renderMessageWithoutLink({
      message: variant.message,
      commenterName: row.commenterName,
    });
    const destination = variant.destinationUrl
      ? appendMarketingTrackingParams(variant.destinationUrl, {
          keys: automation.trackingParamKeys,
          accountName: automation.instagramAccount.username,
          accountId: automation.instagramAccount.instagramId,
          campaignId: automation.id,
          eventId: automation.trackingEventId,
          commenterId: row.userId,
        })
      : null;
    sendStarted = true;
    if (destination) {
      await sendDirectMessageWithLinkButton({
        context,
        instagramAccountId: automation.instagramAccount.instagramId,
        userId: row.userId,
        text: message,
        buttons: [
          { title: variant.buttonLabel || "Open link", url: destination },
        ],
      });
    } else {
      await sendDirectMessage({
        context,
        instagramAccountId: automation.instagramAccount.instagramId,
        userId: row.userId,
        message,
      });
    }
    await prisma.sharedFollowUpDelivery.update({
      where: { id: row.id },
      data: { status: "SENT", sentAt: new Date(), errorMessage: null },
    });
  } catch (error) {
    const rejected = !sendStarted || isConfirmedSendRejection(error);
    if (rejected && reservation?.allowed)
      await releaseWorkspaceDMReservation(
        automation.workspaceId,
        reservation.periodStart,
      );
    await prisma.sharedFollowUpDelivery.update({
      where: { id: row.id },
      data: {
        status: rejected ? "FAILED" : "UNCONFIRMED",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 2000)
            : "Follow-up delivery failed",
      },
    });
  }
}
