import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { decryptToken, encryptToken } from "@/lib/meta/oauth";
import { refreshLongLivedToken } from "@/lib/meta/client";
import { createHash } from "node:crypto";

const DAYS_BEFORE_EXPIRY = 10;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + DAYS_BEFORE_EXPIRY);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const usageReset = await prisma.workspace.updateMany({
    where: { usagePeriodStart: { lt: monthStart } },
    data: {
      usagePeriodStart: monthStart,
      dmsSentThisPeriod: 0,
    },
  });

  const accountsToRefresh = await prisma.instagramAccount.findMany({
    where: {
      accessToken: { not: "" },
      provider: "META",
      tokenExpiresAt: {
        not: null,
        lte: cutoffDate,
      },
    },
    select: {
      id: true,
      workspaceId: true,
      username: true,
      accessToken: true,
    },
  });

  const results: Array<{
    instagramAccountId: string;
    username: string;
    status: "refreshed" | "failed";
    error?: string;
  }> = [];

  for (const account of accountsToRefresh) {
    try {
      const currentToken = decryptToken(account.accessToken);
      const { accessToken: newToken, expiresIn } =
        await refreshLongLivedToken(currentToken);
      const encryptedToken = encryptToken(newToken);
      const newExpiry = new Date(Date.now() + expiresIn * 1000);

      await prisma.instagramAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptedToken,
          tokenExpiresAt: newExpiry,
        },
      });

      results.push({
        instagramAccountId: account.id,
        username: account.username,
        status: "refreshed",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await prisma.operationalEvent.create({
        data: {
          workspaceId: account.workspaceId,
          source: "TOKEN_REFRESH",
          level: "ERROR",
          message: `Token refresh failed for @${account.username}: ${errorMessage}`,
          payload: {
            instagramAccountId: account.id,
            username: account.username,
          },
        },
      });

      results.push({
        instagramAccountId: account.id,
        username: account.username,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  // Developer-dashboard tokens may not report their expiry at import time.
  // Refresh those after a week; a successful refresh supplies a real expiry.
  const credentials = await prisma.instagramCredential.findMany({
    where: { OR: [
      { tokenExpiresAt: { lte: cutoffDate } },
      { tokenExpiresAt: null, refreshedAt: { lte: new Date(Date.now() - 7 * 86400_000) } },
    ] },
    include: { instagramAccount: { select: { workspaceId: true } } },
  });
  for (const credential of credentials) {
    try {
      const { accessToken, expiresIn } = await refreshLongLivedToken(decryptToken(credential.accessToken));
      await prisma.instagramCredential.update({
        where: { id: credential.id },
        data: { accessToken: encryptToken(accessToken),
          tokenFingerprint: createHash("sha256").update(accessToken).digest("hex"),
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000), refreshedAt: new Date(),
        },
      });
    } catch {
      await prisma.operationalEvent.create({ data: {
        workspaceId: credential.instagramAccount.workspaceId, source: "TOKEN_REFRESH", level: "ERROR",
        message: `Token refresh failed for Instagram credential ${credential.name}`,
        payload: { credentialId: credential.id, instagramAccountId: credential.instagramAccountId },
      } });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      totalProcessed: accountsToRefresh.length,
      workspacesReset: usageReset.count,
      results,
    },
  });
}
