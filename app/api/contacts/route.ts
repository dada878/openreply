import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

// Instagram contact identities and captured email addresses are personally
// identifiable data. Contacts are therefore restricted to workspace owners
// and admins.
export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can view contacts" },
      { status: 403 },
    );
  }

  const [captures, sentMessages] = await Promise.all([
    prisma.emailCapture.findMany({
      where: {
        workspaceId: context.workspaceId,
        capturedAt: { not: null },
        email: { not: null },
      },
      select: {
        commenterId: true,
        commenterName: true,
        email: true,
        capturedAt: true,
        automation: { select: { id: true, name: true } },
      },
      orderBy: { capturedAt: "desc" },
    }),
    prisma.dmLog.findMany({
      where: {
        workspaceId: context.workspaceId,
        status: "SENT",
        dmSentAt: { not: null },
      },
      select: {
        commenterId: true,
        commenterName: true,
        dmSentAt: true,
        automation: { select: { id: true, name: true } },
      },
      orderBy: { dmSentAt: "desc" },
    }),
  ]);

  type Contact = {
    commenterId: string;
    commenterName: string | null;
    email: string | null;
    lastInteractionAt: Date;
    campaigns: { id: string; name: string }[];
  };
  const contacts = new Map<string, Contact>();

  function addCampaign(contact: Contact, campaign: { id: string; name: string }) {
    if (!contact.campaigns.some((existing) => existing.id === campaign.id)) {
      contact.campaigns.push(campaign);
    }
  }

  for (const message of sentMessages) {
    if (!message.dmSentAt) continue;
    const existing = contacts.get(message.commenterId);
    if (!existing) {
      contacts.set(message.commenterId, {
        commenterId: message.commenterId,
        commenterName: message.commenterName,
        email: null,
        lastInteractionAt: message.dmSentAt,
        campaigns: [message.automation],
      });
      continue;
    }
    existing.commenterName ||= message.commenterName;
    existing.lastInteractionAt =
      existing.lastInteractionAt > message.dmSentAt
        ? existing.lastInteractionAt
        : message.dmSentAt;
    addCampaign(existing, message.automation);
  }

  for (const capture of captures) {
    if (!capture.email || !capture.capturedAt) continue;
    const existing = contacts.get(capture.commenterId);
    if (!existing) {
      contacts.set(capture.commenterId, {
        commenterId: capture.commenterId,
        commenterName: capture.commenterName,
        email: capture.email,
        lastInteractionAt: capture.capturedAt,
        campaigns: [capture.automation],
      });
      continue;
    }
    existing.commenterName ||= capture.commenterName;
    existing.email ||= capture.email;
    existing.lastInteractionAt =
      existing.lastInteractionAt > capture.capturedAt
        ? existing.lastInteractionAt
        : capture.capturedAt;
    addCampaign(existing, capture.automation);
  }

  return NextResponse.json(
    {
      success: true,
      data: [...contacts.values()].sort(
        (a, b) => b.lastInteractionAt.getTime() - a.lastInteractionAt.getTime(),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
