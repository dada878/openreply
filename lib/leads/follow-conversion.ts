import { prisma } from "@/lib/db/client";

/** Record one unique follow verified through an automation's follow gate. */
export async function recordFollowConversion({
  workspaceId,
  automationId,
  instagramAccountId,
  commenterId,
  commenterName,
  sourcePostId,
}: {
  workspaceId: string;
  automationId: string;
  instagramAccountId: string;
  commenterId: string;
  commenterName: string | null;
  sourcePostId?: string | null;
}) {
  return prisma.followConversion.upsert({
    where: { automationId_commenterId: { automationId, commenterId } },
    create: {
      workspaceId,
      automationId,
      instagramAccountId,
      commenterId,
      commenterName,
      sourcePostId: sourcePostId ?? null,
    },
    update: { commenterName: commenterName ?? undefined },
  });
}
