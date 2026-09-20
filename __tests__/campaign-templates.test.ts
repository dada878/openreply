import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  campaignTemplateSchema,
  type TemplateConfig,
} from "../lib/templates/saved-schema";

const config: TemplateConfig = {
  version: 1,
  triggerScope: "specific",
  keywords: ["LINK", "資源"],
  matchAnyWord: false,
  wholeWordMatch: false,
  dmTriggerEnabled: true,
  dmMessage: "Here you go {username}: {link}",
  openingDmEnabled: true,
  openingDmMessage: "Tap below",
  openingDmButtonLabel: "Send it",
  publicReplyEnabled: true,
  publicReplyMessages: ["Sent!", "請查看私訊"],
  trackedDestinationUrl: "https://example.com/primary",
  linkButtonLabel: "取得資源",
  secondaryDestinationUrl: "https://example.com/secondary",
  secondaryButtonLabel: "Read more",
  requireFollow: true,
  followPromptMessage: "Follow first",
  followPromptButtonLabel: "I'm following",
  followUpEnabled: true,
  followUpMessage: "Thanks!",
  followUpDelayMinutes: 30,
};
const template = { name: "Resource giveaway", config };

describe("saved template contract", () => {
  it("preserves all workflow settings and message placeholders", () => {
    expect(campaignTemplateSchema.parse(template)).toEqual(template);
  });

  it("excludes bindings, active state, analytics and untrusted ownership", () => {
    expect(
      campaignTemplateSchema.parse({
        ...template,
        workspaceId: "other",
        id: "old-template",
        config: {
          ...config,
          instagramAccountId: "account",
          postId: "post",
          postUrl: "https://example.com/post",
          isActive: true,
          reportShareSlug: "report",
          trackedLinks: [{ slug: "old" }],
        },
      }),
    ).toEqual(template);
  });

  it.each([
    { name: " " },
    { config: { ...config, dmMessage: " " } },
    { config: { ...config, keywords: [] } },
    { config: { ...config, openingDmButtonLabel: " " } },
    { config: { ...config, trackedDestinationUrl: "not a url" } },
    { config: { ...config, followUpDelayMinutes: 1441 } },
    { config: { ...config, version: 2 } },
  ])("rejects invalid templates: %j", (patch) => {
    expect(
      campaignTemplateSchema.safeParse({ ...template, ...patch }).success,
    ).toBe(false);
  });

  it("allows any-word triggers and preserves disabled step drafts", () => {
    const draft = {
      ...config,
      matchAnyWord: true,
      keywords: [],
      openingDmEnabled: false,
      openingDmButtonLabel: "",
    };
    expect(
      campaignTemplateSchema.parse({ ...template, config: draft }).config,
    ).toEqual(draft);
  });
});

const state = vi.hoisted(() => ({
  db: undefined as unknown as import("../app/generated/prisma/client").PrismaClient,
  role: "OWNER",
  authenticated: true,
}));
vi.mock("@/lib/db/client", () => ({
  get prisma() {
    return state.db;
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentWorkspaceId: async () => "workspace_test",
}));
vi.mock("@/lib/workspace-access", () => ({
  canManageWorkspace: (role: string) => role === "OWNER" || role === "ADMIN",
  getCurrentWorkspaceContext: async () =>
    state.authenticated
      ? {
          workspaceId: "workspace_test",
          userId: "user_test",
          role: state.role,
        }
      : null,
}));
import { GET, POST, PUT, DELETE } from "../app/api/campaign-templates/route";
import { POST as createCampaign } from "../app/api/automations/route";

function request(method: string, body?: unknown, id?: string) {
  return new NextRequest(
    `http://localhost/api/campaign-templates${id ? `?id=${id}` : ""}`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  state.role = "OWNER";
  state.authenticated = true;
});

describe("template access control", () => {
  it("requires login to list creation options", async () => {
    state.authenticated = false;
    expect((await GET()).status).toBe(401);
  });
  it.each([POST, PUT, DELETE])(
    "requires login before touching storage",
    async (handler) => {
      state.authenticated = false;
      expect(
        (await handler(request(handler === DELETE ? "DELETE" : "POST"))).status,
      ).toBe(401);
    },
  );
  it.each([POST, PUT, DELETE])(
    "prevents members from writing",
    async (handler) => {
      state.role = "MEMBER";
      expect(
        (await handler(request(handler === DELETE ? "DELETE" : "POST"))).status,
      ).toBe(403);
    },
  );
  it.each([PUT, DELETE])("rejects missing IDs", async (handler) => {
    expect(
      (
        await handler(
          request(
            handler === DELETE ? "DELETE" : "PUT",
            handler === DELETE ? undefined : template,
          ),
        )
      ).status,
    ).toBe(400);
  });
  it("rejects malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/campaign-templates", {
        method: "POST",
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
  });
});

// Like the tracked-link regression suite, this applies the real migrations in
// a disposable schema. No app data or Instagram delivery is touched.
const DATABASE_URL = process.env.TEST_DATABASE_URL;
const schema = `campaign_templates_${randomBytes(4).toString("hex")}`;
let sql: Client;
describe.skipIf(!DATABASE_URL)("templates on Postgres", () => {
  beforeAll(async () => {
    sql = new Client({ connectionString: DATABASE_URL });
    await sql.connect();
    await sql.query(`CREATE SCHEMA "${schema}"`);
    await sql.query(`SET search_path TO "${schema}"`);
    const root = path.join(__dirname, "..", "prisma", "migrations");
    for (const entry of readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      await sql.query(
        readFileSync(path.join(root, entry.name, "migration.sql"), "utf8"),
      );
    }
    state.db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: DATABASE_URL }, { schema }),
    });
    await state.db.user.create({
      data: { id: "user_test", email: "template@example.test" },
    });
    await state.db.workspace.createMany({
      data: [
        { id: "workspace_test", name: "Templates", ownerId: "user_test" },
        { id: "workspace_other", name: "Other", ownerId: "user_test" },
      ],
    });
    await state.db.instagramAccount.create({
      data: {
        id: "account_test",
        workspaceId: "workspace_test",
        instagramId: "ig_template",
        username: "template",
        accessToken: "local-placeholder",
      },
    });
  }, 60_000);
  afterAll(async () => {
    await state.db?.$disconnect();
    if (sql) {
      await sql.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await sql.end();
    }
  });

  async function save() {
    const response = await POST(
      request("POST", { ...template, workspaceId: "workspace_other" }),
    );
    expect(response.status).toBe(201);
    return (await response.json()).data.id as string;
  }

  it("lists only this workspace's five newest template names, with overflow only above five", async () => {
    state.role = "MEMBER";
    const rows = Array.from({ length: 6 }, (_, index) => ({
      ...template,
      id: `option_${index}`,
      name: `Option ${index}`,
      workspaceId: "workspace_test",
      updatedAt: new Date(2026, 0, index + 1),
    }));
    const other = await state.db.campaignTemplate.create({
      data: { ...template, workspaceId: "workspace_other" },
    });
    try {
      expect(await (await GET()).json()).toEqual({
        success: true,
        data: [],
        hasMore: false,
      });
      await state.db.campaignTemplate.createMany({ data: rows.slice(0, 5) });
      const expected = rows
        .slice(0, 5)
        .reverse()
        .map(({ id, name }) => ({ id, name }));
      expect(await (await GET()).json()).toEqual({
        success: true,
        data: expected,
        hasMore: false,
      });
      await state.db.campaignTemplate.create({ data: rows[5] });
      expect(await (await GET()).json()).toEqual({
        success: true,
        data: rows
          .slice(1)
          .reverse()
          .map(({ id, name }) => ({ id, name })),
        hasMore: true,
      });
    } finally {
      await state.db.campaignTemplate.deleteMany({
        where: { id: { in: [...rows.map(({ id }) => id), other.id] } },
      });
    }
  });

  it("persists the complete flow under the authenticated workspace, without an Instagram binding", async () => {
    state.role = "ADMIN";
    const id = await save();
    const row = await state.db.campaignTemplate.findUniqueOrThrow({
      where: { id },
    });
    expect(row).toMatchObject({ ...template, workspaceId: "workspace_test" });
    expect(await state.db.automation.count()).toBe(0);
  });

  it("renames and edits a saved flow", async () => {
    const id = await save();
    const updated = {
      name: "Updated",
      config: { ...config, dmMessage: "New content" },
    };
    expect((await PUT(request("PUT", updated, id))).status).toBe(200);
    expect(
      await state.db.campaignTemplate.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject(updated);
  });

  it("prevents update and delete across workspaces", async () => {
    const row = await state.db.campaignTemplate.create({
      data: { ...template, workspaceId: "workspace_other" },
    });
    expect(
      (await PUT(request("PUT", { ...template, name: "Hijacked" }, row.id)))
        .status,
    ).toBe(404);
    expect((await DELETE(request("DELETE", undefined, row.id))).status).toBe(
      404,
    );
    expect(
      await state.db.campaignTemplate.findUniqueOrThrow({
        where: { id: row.id },
      }),
    ).toMatchObject(template);
  });

  it("rejects invalid updates without modifying stored data", async () => {
    const id = await save();
    expect(
      (
        await PUT(
          request(
            "PUT",
            { ...template, config: { ...config, keywords: [] } },
            id,
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      await state.db.campaignTemplate.findUniqueOrThrow({ where: { id } }),
    ).toMatchObject(template);
  });

  it("creates independent campaigns with fresh tracking links; editing or deleting the template leaves them intact", async () => {
    const id = await save();
    const { triggerScope, version, ...workflow } = config;
    expect(triggerScope).toBe("specific");
    expect(version).toBe(1);
    const create = async (postId: string) => {
      const response = await createCampaign(
        new NextRequest("http://localhost/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...workflow,
            name: template.name,
            instagramAccountId: "account_test",
            postId,
            isActive: false,
          }),
        }),
      );
      expect(response.status).toBe(201);
      return (await response.json()).data;
    };
    const first = await create("post_one");
    const second = await create("post_two");
    expect(first).toMatchObject({
      dmMessage: config.dmMessage,
      requireFollow: true,
      dmTriggerEnabled: true,
      followUpDelayMinutes: 30,
      wholeWordMatch: false,
      isActive: false,
      postId: "post_one",
    });
    expect(
      first.trackedLinks
        .map((link: { destinationUrl: string }) => link.destinationUrl)
        .sort(),
    ).toEqual(
      [config.trackedDestinationUrl, config.secondaryDestinationUrl].sort(),
    );
    expect(
      new Set(
        [...first.trackedLinks, ...second.trackedLinks].map(
          (link) => link.slug,
        ),
      ).size,
    ).toBe(4);
    expect(first.reportShareSlug).not.toBe(second.reportShareSlug);
    await PUT(request("PUT", { ...template, name: "Changed" }, id));
    expect((await DELETE(request("DELETE", undefined, id))).status).toBe(200);
    expect(
      await state.db.campaignTemplate.findUnique({ where: { id } }),
    ).toBeNull();
    expect(
      await state.db.automation.findUniqueOrThrow({ where: { id: first.id } }),
    ).toMatchObject({ name: template.name, dmMessage: config.dmMessage });
    expect((await DELETE(request("DELETE", undefined, id))).status).toBe(404);
  });

  it("removes saved templates when their workspace is deleted", async () => {
    const row = await state.db.campaignTemplate.create({
      data: { ...template, workspaceId: "workspace_other" },
    });
    await state.db.workspace.delete({ where: { id: "workspace_other" } });
    expect(
      await state.db.campaignTemplate.findUnique({ where: { id: row.id } }),
    ).toBeNull();
  });
});
