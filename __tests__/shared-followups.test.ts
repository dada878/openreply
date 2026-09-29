import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => {
  const delivery = {
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  };
  const db = {
    sharedFollowUp: { findFirst: vi.fn() },
    sharedFollowUpDelivery: delivery,
    automation: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  return {
    db,
    delivery,
    redis: { get: vi.fn(), eval: vi.fn() },
    add: vi.fn(),
    send: vi.fn(),
    link: vi.fn(),
    context: vi.fn(),
    reserve: vi.fn(),
    release: vi.fn(),
    rejected: vi.fn(),
  };
});
vi.mock("@/lib/db/client", () => ({ prisma: m.db }));
vi.mock("@/lib/queue/client", () => ({
  getRedisConnection: () => m.redis,
  getDMQueue: () => ({ add: m.add }),
}));
vi.mock("@/lib/instagram/provider", () => ({
  createInstagramContext: m.context,
  sendDirectMessage: m.send,
  sendDirectMessageWithLinkButton: m.link,
}));
vi.mock("@/lib/billing/usage", () => ({
  reserveWorkspaceDMSend: m.reserve,
  releaseWorkspaceDMReservation: m.release,
}));
vi.mock("@/lib/instagram/delivery-errors", () => ({
  isConfirmedSendRejection: m.rejected,
}));
import { followUpSchema } from "@/lib/follow-ups/schema";
import {
  scheduleSharedFollowUp,
  recordFollowUpInteraction,
  processSharedFollowUp,
  enqueueDueFollowUps,
} from "@/lib/follow-ups/delivery";
const variants = [
  {
    name: "Course A",
    message: "Hello {username}",
    destinationUrl: "",
    buttonLabel: "",
  },
  {
    name: "Course B",
    message: "Second offer",
    destinationUrl: "https://example.com/course",
    buttonLabel: "Read more",
  },
];
const promo = {
  id: "promo",
  workspaceId: "workspace",
  variants,
  selectionMode: "SEQUENTIAL",
  allowRepeat: false,
  delayMinutes: 3,
  isActive: true,
  archivedAt: null,
};
const input = {
  automation: {
    id: "campaign",
    workspaceId: "workspace",
    instagramAccountId: "account",
  },
  userId: "recipient",
  commenterName: "Reader",
  sourceKey: "comment:1",
};
const row = () => ({
  ...input,
  ...input.automation,
  id: "delivery",
  automationId: "campaign",
  followUp: promo,
  variant: variants[0],
  dueAt: new Date(Date.now() - 1000),
  status: "PENDING",
});
beforeEach(() => {
  vi.resetAllMocks();
  m.db.$transaction.mockImplementation((fn) => fn(m.db));
  m.db.sharedFollowUp.findFirst.mockResolvedValue(promo);
  m.delivery.count.mockResolvedValue(0);
  m.delivery.findUnique.mockResolvedValue(null);
  m.delivery.updateMany.mockResolvedValue({ count: 1 });
  m.db.automation.findFirst.mockResolvedValue({
    ...input.automation,
    instagramCredentialId: "credential",
    instagramAccount: { instagramId: "ig", username: "owner" },
    trackingParamKeys: [],
  });
  m.redis.get.mockResolvedValue(String(Date.now() + 3600000));
  m.reserve.mockResolvedValue({ allowed: true, periodStart: new Date() });
  m.context.mockResolvedValue({ provider: "meta" });
});
describe("shared follow-up settings and scheduling", () => {
  it("defaults to paused, once per recipient, and three minutes", () => {
    expect(followUpSchema.parse({ name: "Offer", variants })).toMatchObject({
      delayMinutes: 3,
      isActive: false,
      allowRepeat: false,
    });
    expect(
      followUpSchema.safeParse({
        name: "Offer",
        variants: [{ ...variants[0], destinationUrl: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
  });
  it("falls back to campaign follow-up when no shared promotion is active", async () => {
    m.db.sharedFollowUp.findFirst.mockResolvedValue(null);
    expect(await scheduleSharedFollowUp(input)).toBe(false);
    expect(m.delivery.create).not.toHaveBeenCalled();
  });
  it("schedules a durable content snapshot three minutes after completion", async () => {
    const before = Date.now();
    expect(await scheduleSharedFollowUp(input)).toBe(true);
    const data = m.delivery.create.mock.calls[0][0].data;
    expect(data.variant).toEqual(variants[0]);
    expect(data.dueAt.getTime()).toBeGreaterThanOrEqual(before + 180000);
    expect(data.dueAt.getTime()).toBeLessThanOrEqual(Date.now() + 180000);
  });
  it("does not repeat across campaigns for the same person when disabled", async () => {
    m.delivery.count.mockResolvedValue(1);
    await scheduleSharedFollowUp({
      ...input,
      automation: { ...input.automation, id: "another" },
    });
    expect(m.delivery.create).not.toHaveBeenCalled();
    expect(m.delivery.count).toHaveBeenCalledWith({
      where: {
        followUpId: "promo",
        instagramAccountId: "account",
        userId: "recipient",
      },
    });
  });
  it("rotates independently per recipient when repetition is enabled", async () => {
    m.db.sharedFollowUp.findFirst.mockResolvedValue({
      ...promo,
      allowRepeat: true,
    });
    m.delivery.count.mockResolvedValue(3);
    await scheduleSharedFollowUp(input);
    expect(m.delivery.create.mock.calls[0][0].data.variant).toEqual(
      variants[1],
    );
  });
  it("never repeats the same source event even with repetition enabled", async () => {
    m.db.sharedFollowUp.findFirst.mockResolvedValue({
      ...promo,
      allowRepeat: true,
    });
    m.delivery.findUnique.mockResolvedValue({ id: "existing" });
    await scheduleSharedFollowUp(input);
    expect(m.delivery.create).not.toHaveBeenCalled();
  });
  it("random selection always uses an actual configured entry", async () => {
    m.db.sharedFollowUp.findFirst.mockResolvedValue({
      ...promo,
      selectionMode: "RANDOM",
    });
    await scheduleSharedFollowUp(input);
    expect(variants).toContainEqual(
      m.delivery.create.mock.calls[0][0].data.variant,
    );
  });
});
describe("shared follow-up delivery protection", () => {
  beforeEach(() => m.delivery.findUnique.mockResolvedValue(row()));
  it("skips recipients without a messaging window", async () => {
    m.redis.get.mockResolvedValue(null);
    await processSharedFollowUp("delivery");
    expect(m.delivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SKIPPED_WINDOW" }),
      }),
    );
    expect(m.send).not.toHaveBeenCalled();
  });
  it("cancels paused promotions", async () => {
    m.delivery.findUnique.mockResolvedValue({
      ...row(),
      followUp: { ...promo, isActive: false },
    });
    await processSharedFollowUp("delivery");
    expect(m.send).not.toHaveBeenCalled();
    expect(m.delivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });
  it("honors the source campaign credential and personalizes the message", async () => {
    await processSharedFollowUp("delivery");
    expect(m.context).toHaveBeenCalledWith(
      expect.anything(),
      "delivery",
      "credential",
    );
    expect(m.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Hello Reader", userId: "recipient" }),
    );
    expect(m.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
  });
  it("uses the saved link button variant", async () => {
    m.delivery.findUnique.mockResolvedValue({ ...row(), variant: variants[1] });
    await processSharedFollowUp("delivery");
    expect(m.link).toHaveBeenCalledWith(
      expect.objectContaining({
        buttons: [{ title: "Read more", url: "https://example.com/course" }],
      }),
    );
    expect(m.send).not.toHaveBeenCalled();
  });
  it("a competing worker cannot send an already claimed delivery", async () => {
    m.delivery.updateMany.mockResolvedValue({ count: 0 });
    await processSharedFollowUp("delivery");
    expect(m.send).not.toHaveBeenCalled();
  });
  it("does not send again after an uncertain network outcome", async () => {
    m.send.mockRejectedValue(new Error("connection lost"));
    await processSharedFollowUp("delivery");
    expect(m.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "UNCONFIRMED" }),
      }),
    );
    expect(m.release).not.toHaveBeenCalled();
    m.delivery.findUnique.mockResolvedValue({
      ...row(),
      status: "UNCONFIRMED",
    });
    await processSharedFollowUp("delivery");
    expect(m.send).toHaveBeenCalledTimes(1);
  });
  it("does not resend when the success receipt fails to persist", async () => {
    m.delivery.update.mockRejectedValueOnce(new Error("database unavailable"));
    await processSharedFollowUp("delivery");
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.delivery.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "UNCONFIRMED" }),
      }),
    );
  });
  it("releases billing only on an explicit send rejection", async () => {
    m.send.mockRejectedValue(new Error("rejected"));
    m.rejected.mockReturnValue(true);
    await processSharedFollowUp("delivery");
    expect(m.release).toHaveBeenCalledOnce();
    expect(m.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
  it("does not reopen the messaging window from old queued interactions", async () => {
    await recordFollowUpInteraction(
      "ig",
      "recipient",
      Date.now() - 25 * 3600000,
    );
    expect(m.redis.eval).not.toHaveBeenCalled();
    await recordFollowUpInteraction("ig", "recipient", Date.now() - 60000);
    expect(m.redis.eval).toHaveBeenCalledOnce();
  });
  it("recovers due jobs without queue-level send retries", async () => {
    m.delivery.findMany.mockResolvedValue([{ id: "delivery" }]);
    await enqueueDueFollowUps();
    expect(m.add).toHaveBeenCalledWith(
      "shared-followup",
      { deliveryId: "delivery" },
      expect.objectContaining({
        attempts: 1,
        jobId: "shared-followup_delivery",
      }),
    );
  });
});
