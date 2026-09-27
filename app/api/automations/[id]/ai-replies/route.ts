import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { stringifyCsv } from "@/lib/utils/csv";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

/**
 * Return the AI public-reply audit trail for one campaign. The CSV variant is
 * deliberately workspace-scoped and owner/admin-only because it contains user
 * comments and Instagram identities.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can export AI replies" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const automation = await prisma.automation.findFirst({
    where: { id, workspaceId: context.workspaceId },
    select: {
      id: true,
      name: true,
      postId: true,
      postUrl: true,
      instagramAccount: { select: { username: true } },
    },
  });
  if (!automation) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }

  const logs = await prisma.dmLog.findMany({
    where: {
      automationId: automation.id,
      workspaceId: context.workspaceId,
      aiPublicReplyInput: { not: null },
      aiPublicReplyOutput: { not: null },
    },
    select: {
      commentId: true,
      commenterId: true,
      commenterName: true,
      commenterDisplayName: true,
      commentText: true,
      commentCreatedAt: true,
      commentLikeCount: true,
      aiPublicReplyInput: true,
      aiPublicReplyOutput: true,
      aiPublicReplyModel: true,
      createdAt: true,
      publicReplySentAt: true,
      status: true,
      matchedKeyword: true,
    },
    orderBy: [{ commentCreatedAt: "desc" }, { createdAt: "desc" }],
  });

  const rows = logs.map((log) => [
    automation.instagramAccount.username,
    log.commenterName ?? "",
    log.commenterDisplayName ?? "",
    log.commenterId,
    log.commentId,
    log.aiPublicReplyInput ?? log.commentText,
    log.aiPublicReplyOutput ?? "",
    log.aiPublicReplyModel ?? "",
    (log.commentCreatedAt ?? log.createdAt).toISOString(),
    log.createdAt.toISOString(),
    log.publicReplySentAt?.toISOString() ?? "",
    log.commentLikeCount === null ? "" : String(log.commentLikeCount),
    log.matchedKeyword ?? "",
    log.status,
    automation.name,
    automation.postId ?? "",
    automation.postUrl ?? "",
  ]);
  const csv = stringifyCsv(
    [
      "instagram_account",
      "username",
      "display_name",
      "commenter_id",
      "comment_id",
      "comment_input",
      "ai_output",
      "ai_model",
      "commented_at",
      "recorded_at",
      "public_reply_sent_at",
      "comment_like_count",
      "matched_keyword",
      "status",
      "campaign",
      "post_id",
      "post_url",
    ],
    rows,
  );

  const filename = `${automation.name.replace(/[^a-z0-9-_]+/gi, "-") || "campaign"}-ai-replies.csv`;
  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
