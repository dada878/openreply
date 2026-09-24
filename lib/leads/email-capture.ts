import { z } from "zod";
import { prisma } from "@/lib/db/client";

export const DEFAULT_EMAIL_PROMPT =
  "請直接回覆你的 Email，我就把內容傳給你。";

export const DEFAULT_INVALID_EMAIL_MESSAGE = "請輸入有效的 Email。";

const emailSchema = z.string().trim().toLowerCase().email().max(320);

export function normalizeCapturedEmail(value: string): string | null {
  const parsed = emailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function startEmailCapture({
  workspaceId,
  automationId,
  instagramAccountId,
  commenterId,
  commenterName,
}: {
  workspaceId: string;
  automationId: string;
  instagramAccountId: string;
  commenterId: string;
  commenterName: string | null;
}) {
  // Email ownership is scoped to the Instagram account and user, rather than
  // to one resource pack. Once a person has supplied an email for any active
  // campaign on this account, a new campaign can reuse it without prompting
  // again.
  const reusableCapture = await prisma.emailCapture.findFirst({
    where: {
      instagramAccountId,
      commenterId,
      automationId: { not: automationId },
      email: { not: null },
      capturedAt: { not: null },
    },
    select: { email: true, capturedAt: true },
    orderBy: { capturedAt: "desc" },
  });

  const capture = await prisma.emailCapture.upsert({
    where: { automationId_commenterId: { automationId, commenterId } },
    create: {
      workspaceId,
      automationId,
      instagramAccountId,
      commenterId,
      commenterName,
      email: reusableCapture?.email ?? undefined,
      capturedAt: reusableCapture?.capturedAt ?? undefined,
    },
    update: { commenterName: commenterName ?? undefined },
  });

  // The campaign row may already exist from an earlier prompt. Fill that
  // pending row from the account-level capture when one is found, while the
  // `email: null` guard keeps concurrent workers from overwriting a newer
  // submission.
  if (!capture.email && reusableCapture?.email) {
    const result = await prisma.emailCapture.updateMany({
      where: { id: capture.id, email: null },
      data: {
        email: reusableCapture.email,
        capturedAt: reusableCapture.capturedAt,
      },
    });
    if (result.count === 1) {
      return {
        ...capture,
        email: reusableCapture.email,
        capturedAt: reusableCapture.capturedAt,
      };
    }
  }

  return capture;
}

export async function claimEmailPrompt(id: string): Promise<boolean> {
  const result = await prisma.emailCapture.updateMany({
    where: {
      id,
      email: null,
      emailPromptClaimedAt: null,
      emailPromptDeliveryUnconfirmed: false,
    },
    data: { emailPromptClaimedAt: new Date() },
  });
  return result.count === 1;
}

export async function markEmailPromptDelivered(id: string): Promise<void> {
  await prisma.emailCapture.update({
    where: { id },
    data: {
      emailPromptSentAt: new Date(),
      emailPromptDeliveryUnconfirmed: false,
      lastError: null,
    },
  });
}

export async function recordEmailPromptFailure({
  id,
  errorMessage,
  deliveryUnconfirmed,
}: {
  id: string;
  errorMessage: string;
  deliveryUnconfirmed: boolean;
}): Promise<void> {
  await prisma.emailCapture.update({
    where: { id },
    data: deliveryUnconfirmed
      ? { emailPromptDeliveryUnconfirmed: true, lastError: errorMessage }
      : {
          emailPromptClaimedAt: null,
          emailPromptDeliveryUnconfirmed: false,
          lastError: errorMessage,
        },
  });
}

export async function captureEmail(id: string, email: string): Promise<boolean> {
  const result = await prisma.emailCapture.updateMany({
    where: { id, email: null, capturedAt: null },
    data: { email, capturedAt: new Date(), lastError: null },
  });
  return result.count === 1;
}

export async function claimEmailContentDelivery(id: string): Promise<boolean> {
  const result = await prisma.emailCapture.updateMany({
    where: {
      id,
      email: { not: null },
      contentDeliveryClaimedAt: null,
      contentDeliveryUnconfirmed: false,
    },
    data: { contentDeliveryClaimedAt: new Date() },
  });
  return result.count === 1;
}

export async function markEmailContentDelivered(id: string): Promise<void> {
  await prisma.emailCapture.update({
    where: { id },
    data: {
      contentDeliveredAt: new Date(),
      contentDeliveryUnconfirmed: false,
      lastError: null,
    },
  });
}

export async function recordEmailContentFailure({
  id,
  errorMessage,
  deliveryUnconfirmed,
}: {
  id: string;
  errorMessage: string;
  deliveryUnconfirmed: boolean;
}): Promise<void> {
  await prisma.emailCapture.update({
    where: { id },
    data: deliveryUnconfirmed
      ? { contentDeliveryUnconfirmed: true, lastError: errorMessage }
      : {
          contentDeliveryClaimedAt: null,
          contentDeliveryUnconfirmed: false,
          lastError: errorMessage,
        },
  });
}
