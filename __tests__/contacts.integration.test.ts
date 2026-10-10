import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { contactCsvStream } from "@/lib/contacts/export";
import { getContactPage } from "@/lib/contacts/query";

// Explicit isolated fixture database; never fall back to DATABASE_URL.
const url = process.env.CONTACTS_TEST_DATABASE_URL;
const db = url
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  : null;
const ownerId = `contacts-test-${randomUUID()}`;
let workspaceId: string;
const options = { page: 1, limit: 25, filter: "all" as const, search: "" };
const time = new Date("2026-10-01T12:00:00.000Z");

describe.skipIf(!db)("database contact pagination", () => {
  beforeAll(async () => {
    const database = db!;
    await database.user.create({ data: { id: ownerId } });
    const workspace = await database.workspace.create({
      data: { ownerId, name: "Contacts test" },
    });
    workspaceId = workspace.id;
    const account = await database.instagramAccount.create({
      data: {
        workspaceId,
        instagramId: ownerId,
        username: "test",
        accessToken: "test-only",
      },
    });
    const campaigns = await Promise.all(
      ["First campaign", "Second campaign"].map((name) =>
        database.automation.create({
          data: {
            workspaceId,
            instagramAccountId: account.id,
            name,
            keywords: [],
            dmMessage: "test",
          },
        }),
      ),
    );
    const base = {
      workspaceId,
      instagramAccountId: account.id,
      automationId: campaigns[0].id,
      commentText: "test",
    };
    await database.dmLog.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        ...base,
        commenterId: `person-${String(i).padStart(2, "0")}`,
        commenterName: i === 5 ? "literal_%_text" : `reader${i}`,
        commentId: `comment-${i}`,
        status: "SENT",
        dmSentAt: time,
      })),
    });
    // Many events must still occupy just one contact position.
    await database.dmLog.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        ...base,
        commenterId: "person-00",
        commenterName: "newest_name",
        commentId: `duplicate-${i}`,
        status: "SENT",
        dmSentAt: new Date(time.getTime() + 1000),
      })),
    });
    await database.dmLog.createMany({
      data: [
        {
          ...base,
          commenterId: "failed-only",
          commentId: "failed",
          status: "FAILED",
          dmSentAt: time,
        },
        {
          ...base,
          commenterId: "no-send-time",
          commentId: "null-time",
          status: "SENT",
        },
      ],
    });
    await database.emailCapture.createMany({
      data: [
        {
          workspaceId,
          instagramAccountId: account.id,
          automationId: campaigns[0].id,
          commenterId: "person-00",
          email: "old@example.com",
          capturedAt: time,
        },
        {
          workspaceId,
          instagramAccountId: account.id,
          automationId: campaigns[1].id,
          commenterId: "person-00",
          commenterName: "capture_name",
          email: "New@example.com",
          capturedAt: new Date(time.getTime() + 2000),
        },
        {
          workspaceId,
          instagramAccountId: account.id,
          automationId: campaigns[0].id,
          commenterId: "email-only",
          commenterName: "email_reader",
          email: "only@example.com",
          capturedAt: new Date(time.getTime() - 1000),
        },
      ],
    });
    const other = await database.workspace.create({
      data: { ownerId, name: "Other tenant" },
    });
    const otherAccount = await database.instagramAccount.create({
      data: {
        workspaceId: other.id,
        instagramId: `${ownerId}-other`,
        username: "other",
        accessToken: "test-only",
      },
    });
    const otherCampaign = await database.automation.create({
      data: {
        workspaceId: other.id,
        instagramAccountId: otherAccount.id,
        name: "Foreign",
        keywords: [],
        dmMessage: "test",
      },
    });
    await database.dmLog.create({
      data: {
        ...base,
        workspaceId: other.id,
        instagramAccountId: otherAccount.id,
        automationId: otherCampaign.id,
        commenterId: "foreign",
        commentId: "foreign",
        status: "SENT",
        dmSentAt: new Date(),
      },
    });
  });
  afterAll(async () => {
    if (db) {
      await db.user.deleteMany({ where: { id: ownerId } });
      await db.$disconnect();
    }
  });

  it("deduplicates before pagination, returns global tab counts, and scopes the workspace", async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        getContactPage(workspaceId, { ...options, page }, db!),
      ),
    );
    expect(pages.map((page) => page.contacts.length)).toEqual([25, 25, 11]);
    expect(pages[0].counts).toEqual({ all: 61, email: 2 });
    expect(pages[0].pagination).toEqual({
      page: 1,
      limit: 25,
      total: 61,
      totalPages: 3,
    });
    const ids = pages.flatMap((page) =>
      page.contacts.map((contact) => contact.commenterId),
    );
    expect(new Set(ids).size).toBe(61);
    expect(ids).not.toContain("foreign");
    expect(ids).not.toContain("failed-only");
  });
  it("preserves the latest email, username fallback priority, campaigns, and UTC timestamps", async () => {
    const page = await getContactPage(workspaceId, options, db!);
    expect(page.contacts[0]).toMatchObject({
      commenterId: "person-00",
      commenterName: "newest_name",
      email: "New@example.com",
      lastInteractionAt: "2026-10-01T12:00:02.000Z",
    });
    expect(
      page.contacts[0].campaigns.map((campaign) => campaign.name).sort(),
    ).toEqual(["First campaign", "Second campaign"]);
  });
  it("filters email contacts before limiting", async () => {
    const page = await getContactPage(
      workspaceId,
      { ...options, filter: "email", limit: 1, page: 2 },
      db!,
    );
    expect(page.contacts.map((contact) => contact.commenterId)).toEqual([
      "email-only",
    ]);
    expect(page.pagination.total).toBe(2);
  });
  it("searches beyond the loaded page by username, email, ID, and source campaign", async () => {
    for (const [search, expected] of [
      ["READER55", "person-55"],
      ["new@", "person-00"],
      ["person-59", "person-59"],
      ["second campaign", "person-00"],
    ]) {
      const page = await getContactPage(
        workspaceId,
        { ...options, search: search.toLowerCase() },
        db!,
      );
      expect(page.contacts.map((contact) => contact.commenterId)).toEqual([
        expected,
      ]);
    }
  });
  it("treats wildcard characters literally and binds malicious search text as data", async () => {
    const wildcard = await getContactPage(
      workspaceId,
      { ...options, search: "%_" },
      db!,
    );
    expect(wildcard.contacts.map((contact) => contact.commenterId)).toEqual([
      "person-05",
    ]);
    const injection = await getContactPage(
      workspaceId,
      { ...options, search: "' OR TRUE --" },
      db!,
    );
    expect(injection.contacts).toEqual([]);
    expect(injection.pagination.total).toBe(0);
  });
  it("clamps an out-of-range page and returns valid metadata for an empty search", async () => {
    const last = await getContactPage(
      workspaceId,
      { ...options, page: 999 },
      db!,
    );
    expect(last.pagination.page).toBe(3);
    expect(last.contacts).toHaveLength(11);
    const empty = await getContactPage(
      workspaceId,
      { ...options, search: "no such contact", page: 999 },
      db!,
    );
    expect(empty.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    });
    expect(empty.contacts).toEqual([]);
  });
  it("streams the complete filtered CSV from a read-only database cursor", async () => {
    const csv = await new Response(
      contactCsvStream(
        workspaceId,
        { ...options, filter: "email" },
        new AbortController().signal,
        url,
      ),
    ).text();
    expect(csv.trim().split("\r\n")).toHaveLength(3);
    expect(csv).toContain("New@example.com");
    expect(csv).toContain("only@example.com");
    expect(csv).not.toContain("foreign");
  });
});
