import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";

// Run against an isolated migrated database, never the production DATABASE_URL.
const url = process.env.FOLLOWUP_TEST_DATABASE_URL;
const db = url
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  : null;
const suffix = randomUUID();
const ownerId = `followup-test-${suffix}`;
afterAll(async () => {
  if (db) {
    await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  }
});
describe.skipIf(!db)("shared follow-up database constraints", () => {
  it("enforces one active group and one receipt per source while allowing distinct repeat events", async () => {
    const database = db!;
    await database.user.create({ data: { id: ownerId } });
    const workspace = await database.workspace.create({
      data: { name: "Integration test", ownerId },
    });
    const first = await database.sharedFollowUp.create({
      data: {
        workspaceId: workspace.id,
        name: "First",
        variants: [],
        isActive: true,
      },
    });
    await expect(
      database.sharedFollowUp.create({
        data: {
          workspaceId: workspace.id,
          name: "Second",
          variants: [],
          isActive: true,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    const receipt = {
      followUpId: first.id,
      automationId: "test",
      instagramAccountId: "test",
      userId: "test",
      dedupeKey: `${suffix}-event1`,
      variant: {},
      dueAt: new Date(),
    };
    const results = await Promise.allSettled([
      database.sharedFollowUpDelivery.create({ data: receipt }),
      database.sharedFollowUpDelivery.create({ data: receipt }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await database.sharedFollowUpDelivery.create({
      data: { ...receipt, dedupeKey: `${suffix}-event2` },
    });
    expect(
      await database.sharedFollowUpDelivery.count({
        where: { followUpId: first.id },
      }),
    ).toBe(2);
    const claims = await Promise.all(
      [0, 1].map(() =>
        database.sharedFollowUpDelivery.updateMany({
          where: { dedupeKey: receipt.dedupeKey, status: "PENDING" },
          data: { status: "SENDING" },
        }),
      ),
    );
    expect(claims.map((result) => result.count).sort()).toEqual([0, 1]);
  });
});
