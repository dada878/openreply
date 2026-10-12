import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import {
  dmKeywordsMayOverlap,
  type DmKeywordMatchMode,
} from "@/lib/utils/dm-keyword-matcher";

export const dynamic = "force-dynamic";

const matchModeSchema = z.enum(["EXACT", "FUZZY", "CONTAINS"]);

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = z.object({
    instagramAccountId: z.string().min(1),
    keywords: z.string().optional().default(""),
    matchAnyWord: z.enum(["true", "false"]).optional().default("false"),
    matchMode: matchModeSchema.optional().default("CONTAINS"),
    excludeId: z.string().optional(),
  }).safeParse({
    instagramAccountId: params.get("instagramAccountId"),
    keywords: params.get("keywords") ?? "",
    matchAnyWord: params.get("matchAnyWord") ?? "false",
    matchMode: params.get("matchMode") ?? "CONTAINS",
    excludeId: params.get("excludeId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
  }

  const input = parsed.data;
  const keywords = input.keywords.split(",").map((keyword) => keyword.trim()).filter(Boolean);
  const candidates = await prisma.automation.findMany({
    where: {
      workspaceId,
      instagramAccountId: input.instagramAccountId,
      dmTriggerEnabled: true,
      isActive: true,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    select: { id: true, name: true, keywords: true, matchAnyWord: true, dmKeywordMatchMode: true },
  });

  const conflicts = candidates.filter((candidate) => {
    if (input.matchAnyWord === "true" || candidate.matchAnyWord) return true;
    return dmKeywordsMayOverlap(
      keywords,
      input.matchMode as DmKeywordMatchMode,
      candidate.keywords,
      candidate.dmKeywordMatchMode as DmKeywordMatchMode,
    );
  }).map(({ id, name, keywords: matchedKeywords, dmKeywordMatchMode }) => ({
    id,
    name,
    keywords: matchedKeywords,
    matchMode: dmKeywordMatchMode,
  }));

  return NextResponse.json({ success: true, data: conflicts });
}
