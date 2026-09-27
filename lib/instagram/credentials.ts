import { prisma } from "@/lib/db/client";
import { getUserInfo } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";

export const credentialSummary = {
  id: true,
  name: true,
  appId: true,
  instagramAccountId: true,
  verifiedAt: true,
  tokenExpiresAt: true,
  createdAt: true,
} as const;

export async function validateCredentialAccount(
  token: string,
  instagramId: string,
) {
  const user = await getUserInfo(token);
  // user_id is the professional account ID. App-scoped id and a matching
  // username are not sufficient proof that a token belongs to this account.
  if (user.user_id !== instagramId) {
    throw new Error(
      "此 Token 不屬於所選的 Instagram 帳號，請使用 Instagram Login 產生該帳號的 Token。",
    );
  }
  return user;
}

export async function canUseInstagramCredential(
  id: string,
  instagramAccountId: string,
  workspaceId: string,
) {
  return Boolean(
    await prisma.instagramCredential.findFirst({
      where: {
        id,
        instagramAccountId,
        instagramAccount: { workspaceId, provider: "META" },
        OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    }),
  );
}

export async function resolveInstagramCredential(
  id: string,
  workspaceId: string,
  instagramId: string,
): Promise<string> {
  const credential = await prisma.instagramCredential.findFirst({
    where: {
      id,
      instagramAccount: { workspaceId, instagramId, provider: "META" },
    },
  });
  if (!credential)
    throw new Error(
      "Selected Instagram credential is unavailable for this account",
    );
  if (credential.tokenExpiresAt && credential.tokenExpiresAt <= new Date()) {
    throw new Error("Selected Instagram credential has expired");
  }
  return decryptToken(credential.accessToken);
}
