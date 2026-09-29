import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  context: vi.fn(),
  tx: {
    $queryRaw: vi.fn(),
    sharedFollowUp: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    sharedFollowUpDelivery: { updateMany: vi.fn() },
  },
  transaction: vi.fn(),
}));
vi.mock("@/lib/workspace-access", () => ({
  getCurrentWorkspaceContext: m.context,
  canManageWorkspace: (role: string) => role === "OWNER" || role === "ADMIN",
}));
vi.mock("@/lib/db/client", () => ({ prisma: { $transaction: m.transaction } }));
import { POST, PUT, DELETE } from "@/app/api/follow-ups/route";
const data = {
  name: "Course",
  variants: [{ name: "A", message: "Hello" }],
  isActive: true,
};
const req = (method: string, id?: string, body: unknown = data) =>
  new NextRequest(`http://localhost/api/follow-ups${id ? `?id=${id}` : ""}`, {
    method,
    ...(method === "DELETE" ? {} : { body: JSON.stringify(body) }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.context.mockResolvedValue({ workspaceId: "workspace", role: "OWNER" });
  m.transaction.mockImplementation((fn) => fn(m.tx));
  m.tx.sharedFollowUp.findFirst.mockResolvedValue({ id: "promo" });
  m.tx.sharedFollowUp.update.mockResolvedValue({ id: "promo" });
  m.tx.sharedFollowUp.create.mockResolvedValue({ id: "promo" });
});
it("requires authentication", async () => {
  m.context.mockResolvedValue(null);
  expect((await POST(req("POST"))).status).toBe(401);
  expect(m.transaction).not.toHaveBeenCalled();
});
it("prevents members from modifying promotions", async () => {
  m.context.mockResolvedValue({ workspaceId: "workspace", role: "MEMBER" });
  expect((await POST(req("POST"))).status).toBe(403);
  expect((await DELETE(req("DELETE", "promo"))).status).toBe(403);
});
it("rejects incomplete messages", async () => {
  expect(
    (await POST(req("POST", undefined, { name: "Empty", variants: [] })))
      .status,
  ).toBe(400);
});
it("scopes updates to the caller's workspace", async () => {
  m.tx.sharedFollowUp.findFirst.mockResolvedValue(null);
  expect((await PUT(req("PUT", "foreign"))).status).toBe(404);
  expect(m.tx.sharedFollowUp.findFirst).toHaveBeenCalledWith({
    where: { id: "foreign", workspaceId: "workspace", archivedAt: null },
  });
  expect(m.tx.sharedFollowUp.update).not.toHaveBeenCalled();
});
it("activation cancels other pending promotions in the same workspace", async () => {
  expect((await PUT(req("PUT", "promo"))).status).toBe(200);
  expect(m.tx.sharedFollowUpDelivery.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        status: "PENDING",
        followUp: { workspaceId: "workspace" },
        followUpId: { not: "promo" },
      },
      data: expect.objectContaining({ status: "CANCELLED" }),
    }),
  );
});
it("pausing cancels pending deliveries", async () => {
  await PUT(req("PUT", "promo", { ...data, isActive: false }));
  expect(m.tx.sharedFollowUpDelivery.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { followUpId: "promo", status: "PENDING" },
      data: expect.objectContaining({ status: "CANCELLED" }),
    }),
  );
});
