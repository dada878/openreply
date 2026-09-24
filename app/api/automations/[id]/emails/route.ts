import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

// This endpoint returns personally identifiable data. Keep it scoped to an
// owner/admin and the campaign's workspace; it is intentionally not part of
// the shareable report or the public campaign API.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can view captured emails" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const automation = await prisma.automation.findFirst({
    where: { id, workspaceId: context.workspaceId },
    select: { id: true, collectEmail: true },
  });
  if (!automation) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }

  const leads = await prisma.emailCapture.findMany({
    where: {
      automationId: automation.id,
      workspaceId: context.workspaceId,
      capturedAt: { not: null },
      email: { not: null },
    },
    select: { email: true, commenterName: true, capturedAt: true },
    orderBy: { capturedAt: "desc" },
  });

  return NextResponse.json(
    { success: true, data: leads },
    { headers: { "Cache-Control": "no-store" } },
  );
}
