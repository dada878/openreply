import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { encryptToken, decryptToken } from "@/lib/meta/oauth";
import { MetaApiError } from "@/lib/meta/client";
import {
  credentialSummary,
  validateCredentialAccount,
} from "@/lib/instagram/credentials";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
const schema = z.object({
  instagramAccountId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  appId: z.string().regex(/^\d{5,30}$/),
  accessToken: z.string().trim().min(20).max(4096),
});
const fail = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status });

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) return fail("Unauthorized", 401);
  const data = await prisma.instagramCredential.findMany({
    where: { instagramAccount: { workspaceId: context.workspaceId } },
    select: credentialSummary,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    { success: true, data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return fail("Unauthorized", 401);
  if (!canManageWorkspace(context.role))
    return fail("Only owners and admins can manage credentials", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return fail("請填寫名稱、數字 App ID 和 Instagram Access Token。", 400);
  const { instagramAccountId, name, appId, accessToken } = parsed.data;
  const account = await prisma.instagramAccount.findFirst({
    where: {
      id: instagramAccountId,
      workspaceId: context.workspaceId,
      provider: "META",
    },
  });
  if (!account) return fail("Instagram account not found", 404);
  try {
    await validateCredentialAccount(accessToken, account.instagramId);
  } catch (error) {
    return fail(
      error instanceof MetaApiError
        ? `Meta 驗證失敗（code ${error.code}）。請確認 Token 有效且具有 Instagram 讀取權限。`
        : "無法確認 Token 屬於所選帳號。請使用該帳號的 Instagram Login Token，再重新驗證。",
      400,
    );
  }
  const data = await prisma.instagramCredential.upsert({
    where: {
      instagramAccountId_tokenFingerprint: {
        instagramAccountId,
        tokenFingerprint: createHash("sha256")
          .update(accessToken)
          .digest("hex"),
      },
    },
    create: {
      instagramAccountId,
      name,
      appId,
      accessToken: encryptToken(accessToken),
      tokenFingerprint: createHash("sha256").update(accessToken).digest("hex"),
    },
    update: { name, appId, verifiedAt: new Date() },
    select: credentialSummary,
  });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function PUT(request: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return fail("Unauthorized", 401);
  if (!canManageWorkspace(context.role))
    return fail("Only owners and admins can test credentials", 403);
  const parsed = z
    .object({ id: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Missing credential ID", 400);
  const credential = await prisma.instagramCredential.findFirst({
    where: {
      id: parsed.data.id,
      instagramAccount: { workspaceId: context.workspaceId },
    },
    include: { instagramAccount: { select: { instagramId: true } } },
  });
  if (!credential) return fail("Credential not found", 404);
  try {
    await validateCredentialAccount(
      decryptToken(credential.accessToken),
      credential.instagramAccount.instagramId,
    );
  } catch {
    return fail("連線驗證失敗。請檢查 Token 是否過期或已撤銷權限。", 400);
  }
  const data = await prisma.instagramCredential.update({
    where: { id: credential.id },
    data: { verifiedAt: new Date() },
    select: credentialSummary,
  });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) return fail("Unauthorized", 401);
  if (!canManageWorkspace(context.role))
    return fail("Only owners and admins can manage credentials", 403);
  const parsed = z
    .object({ id: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Missing credential ID", 400);
  try {
    const deleted = await prisma.instagramCredential.deleteMany({
      where: {
        id: parsed.data.id,
        instagramAccount: { workspaceId: context.workspaceId },
      },
    });
    if (!deleted.count) return fail("Credential not found", 404);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return fail("還有活動使用此憑證。請先切換這些活動的憑證，再移除。", 409);
    }
    throw error;
  }
  return NextResponse.json({ success: true });
}
