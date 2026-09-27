import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getUserInfo, getContext, decryptToken, encryptToken } = vi.hoisted(
  () => ({
    db: {
      instagramAccount: { findFirst: vi.fn() },
      instagramCredential: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
    getUserInfo: vi.fn(),
    getContext: vi.fn(),
    decryptToken: vi.fn((token: string) => `decrypted:${token}`),
    encryptToken: vi.fn((token: string) => `encrypted:${token}`),
  }),
);
vi.mock("@/lib/db/client", () => ({ prisma: db }));
vi.mock("@/lib/meta/oauth", () => ({ decryptToken, encryptToken }));
vi.mock("@/lib/meta/client", () => ({
  getUserInfo,
  MetaApiError: class extends Error {},
}));
vi.mock("@/lib/workspace-access", () => ({
  getCurrentWorkspaceContext: getContext,
  canManageWorkspace: (role: string) => role === "OWNER" || role === "ADMIN",
}));

import { createInstagramContext } from "@/lib/instagram/context";
import {
  canUseInstagramCredential,
  validateCredentialAccount,
} from "@/lib/instagram/credentials";
import { GET, POST, PUT, DELETE } from "@/app/api/instagram/credentials/route";

const account = {
  id: "account-1",
  workspaceId: "workspace-1",
  instagramId: "1784",
  provider: "META" as const,
  accessToken: "original",
  zernioAccountId: null,
};
const payload = {
  instagramAccountId: account.id,
  name: "Video replies",
  appId: "1111008501264260",
  accessToken: "test-token-not-a-real-secret",
};
const request = (body: unknown) =>
  new Request("http://localhost/api/instagram/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  getContext.mockResolvedValue({
    workspaceId: account.workspaceId,
    role: "OWNER",
  });
  db.instagramAccount.findFirst.mockResolvedValue(account);
  db.instagramCredential.findFirst.mockResolvedValue({
    id: "key-2",
    accessToken: "secondary",
    tokenExpiresAt: null,
    instagramAccount: account,
  });
  getUserInfo.mockResolvedValue({
    id: "app-scoped",
    user_id: account.instagramId,
    username: "example",
  });
  db.instagramCredential.upsert.mockResolvedValue({
    id: "key-2",
    name: payload.name,
  });
});

describe("campaign credential routing", () => {
  it("uses the default connection when no explicit credential is selected", async () => {
    expect(await createInstagramContext(account)).toEqual({
      provider: "META",
      accessToken: "decrypted:original",
    });
    expect(db.instagramCredential.findFirst).not.toHaveBeenCalled();
  });
  it("uses the selected credential and checks account and workspace ownership", async () => {
    expect(await createInstagramContext(account, "job-1", "key-2")).toEqual({
      provider: "META",
      accessToken: "decrypted:secondary",
    });
    expect(db.instagramCredential.findFirst).toHaveBeenCalledWith({
      where: {
        id: "key-2",
        instagramAccount: {
          workspaceId: "workspace-1",
          instagramId: "1784",
          provider: "META",
        },
      },
    });
  });
  it("fails without falling back if a selected credential is missing or expired", async () => {
    db.instagramCredential.findFirst.mockResolvedValueOnce(null);
    await expect(
      createInstagramContext(account, undefined, "foreign-key"),
    ).rejects.toThrow("unavailable");
    db.instagramCredential.findFirst.mockResolvedValueOnce({
      accessToken: "expired",
      tokenExpiresAt: new Date(0),
    });
    await expect(
      createInstagramContext(account, undefined, "expired-key"),
    ).rejects.toThrow("expired");
    expect(decryptToken).not.toHaveBeenCalled();
  });
  it("does not apply a Meta token to a Zernio connection", async () => {
    await expect(
      createInstagramContext(
        { ...account, provider: "ZERNIO" },
        undefined,
        "key-2",
      ),
    ).rejects.toThrow("Meta account");
    expect(db.instagramCredential.findFirst).not.toHaveBeenCalled();
  });
  it("rejects app-scoped IDs and usernames as substitutes for account identity", async () => {
    getUserInfo.mockResolvedValueOnce({
      id: account.instagramId,
      username: "example",
    });
    await expect(
      validateCredentialAccount("token", account.instagramId),
    ).rejects.toThrow("不屬於");
  });
  it("checks campaign assignments against account, workspace and expiry", async () => {
    await canUseInstagramCredential("key-2", account.id, account.workspaceId);
    expect(db.instagramCredential.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "key-2",
          instagramAccountId: account.id,
          instagramAccount: {
            workspaceId: account.workspaceId,
            provider: "META",
          },
          OR: [
            { tokenExpiresAt: null },
            { tokenExpiresAt: { gt: expect.any(Date) } },
          ],
        }),
      }),
    );
  });
});

describe("credential management API", () => {
  it("requires authentication and administrator access to save", async () => {
    getContext.mockResolvedValueOnce(null);
    expect((await POST(request(payload))).status).toBe(401);
    getContext.mockResolvedValueOnce({
      workspaceId: account.workspaceId,
      role: "MEMBER",
    });
    expect((await POST(request(payload))).status).toBe(403);
    expect(getUserInfo).not.toHaveBeenCalled();
  });
  it("does not probe tokens for accounts outside the workspace", async () => {
    db.instagramAccount.findFirst.mockResolvedValue(null);
    expect((await POST(request(payload))).status).toBe(404);
    expect(getUserInfo).not.toHaveBeenCalled();
    expect(db.instagramAccount.findFirst).toHaveBeenCalledWith({
      where: {
        id: account.id,
        workspaceId: account.workspaceId,
        provider: "META",
      },
    });
  });
  it("rejects a valid token belonging to a different Instagram account", async () => {
    getUserInfo.mockResolvedValue({
      id: "scoped",
      user_id: "different-account",
      username: "example",
    });
    expect((await POST(request(payload))).status).toBe(400);
    expect(db.instagramCredential.upsert).not.toHaveBeenCalled();
  });
  it("encrypts saved tokens and selects only metadata for responses", async () => {
    const response = await POST(request(payload));
    expect(response.status).toBe(201);
    expect(encryptToken).toHaveBeenCalledWith(payload.accessToken);
    const args = db.instagramCredential.upsert.mock.calls[0][0];
    expect(args.create.accessToken).toBe(`encrypted:${payload.accessToken}`);
    expect(args.select).not.toHaveProperty("accessToken");
    expect(args.select).not.toHaveProperty("tokenFingerprint");
    expect(await response.text()).not.toContain(payload.accessToken);
  });
  it("limits listing to this workspace and excludes both token and fingerprint", async () => {
    db.instagramCredential.findMany.mockResolvedValue([]);
    expect((await GET()).status).toBe(200);
    const args = db.instagramCredential.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      instagramAccount: { workspaceId: account.workspaceId },
    });
    expect(args.select).not.toHaveProperty("accessToken");
    expect(args.select).not.toHaveProperty("tokenFingerprint");
  });
  it("does not leak upstream errors containing a secret", async () => {
    getUserInfo.mockRejectedValue(new Error(`Failed: ${payload.accessToken}`));
    expect(await (await POST(request(payload))).text()).not.toContain(
      payload.accessToken,
    );
  });
  it("tests an existing connection without changing the selected token", async () => {
    db.instagramCredential.update.mockResolvedValue({ id: "key-2" });
    expect((await PUT(request({ id: "key-2" }))).status).toBe(200);
    expect(getUserInfo).toHaveBeenCalledWith("decrypted:secondary");
    expect(db.instagramCredential.update.mock.calls[0][0].data).toEqual({
      verifiedAt: expect.any(Date),
    });
  });
  it("refuses to delete a credential referenced by a campaign", async () => {
    db.instagramCredential.deleteMany.mockRejectedValue({ code: "P2003" });
    expect((await DELETE(request({ id: "key-2" }))).status).toBe(409);
  });
});
