import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  context: vi.fn(),
  page: vi.fn(),
  fetch: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@/lib/workspace-access", () => ({
  getCurrentWorkspaceContext: m.context,
  canManageWorkspace: (role: string) => ["OWNER", "ADMIN"].includes(role),
}));
vi.mock("@/lib/contacts/query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/contacts/query")>()),
  getContactPage: m.page,
}));
vi.mock("pg", () => ({
  Client: class {
    connect = m.connect;
    end = m.end;
    async query(text: string, values?: unknown[]) {
      m.sql(text, values);
      return text.startsWith("FETCH") ? m.fetch() : { rows: [] };
    }
  },
}));
import { parseContactQuery } from "@/lib/contacts/query";
import { contactCsvStream } from "@/lib/contacts/export";
import { GET } from "@/app/api/contacts/route";
const req = (query = "") =>
  new NextRequest(`http://localhost/api/contacts${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  m.context.mockResolvedValue({ workspaceId: "workspace", role: "OWNER" });
  m.page.mockResolvedValue({
    contacts: [],
    counts: { all: 0, email: 0 },
    pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
  });
});
describe("contacts route", () => {
  it("requires owner/admin access for both pages and CSV exports", async () => {
    m.context.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
    m.context.mockResolvedValue({ workspaceId: "workspace", role: "MEMBER" });
    expect((await GET(req())).status).toBe(403);
    expect((await GET(req("?format=csv"))).status).toBe(403);
    expect(m.page).not.toHaveBeenCalled();
  });
  it("bounds page sizes and invalid input", () => {
    for (const query of [
      "page=NaN&limit=oops",
      "page=-1&limit=0",
      "page=Infinity&limit=-50",
    ]) {
      expect(parseContactQuery(new URLSearchParams(query))).toMatchObject({
        page: 1,
        limit: 25,
      });
    }
    expect(
      parseContactQuery(
        new URLSearchParams("page=2&limit=10000&filter=email&q=%20Reader%20"),
      ),
    ).toEqual({ page: 2, limit: 100, filter: "email", search: "reader" });
  });
  it("sends all filters to the scoped database query", async () => {
    const response = await GET(req("?page=3&limit=50&filter=email&q=COURSE"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(m.page).toHaveBeenCalledWith("workspace", {
      page: 3,
      limit: 50,
      filter: "email",
      search: "course",
    });
  });
});
describe("batched contact CSV", () => {
  it("exports all matching pages, rather than only the visible page", async () => {
    const contact = (id: string) => ({
      commenterId: id,
      commenterName: '=HYPERLINK("bad")',
      email: "a@example.com",
      campaigns: [{ id: "campaign", name: 'Course, "quoted"' }],
      lastInteractionAt: "2026-10-01T00:00:00.000Z",
    });
    m.fetch
      .mockResolvedValueOnce({
        rows: Array.from({ length: 100 }, (_, i) => contact(`first-${i}`)),
      })
      .mockResolvedValueOnce({ rows: [contact("last")] });
    const csv = await new Response(
      contactCsvStream(
        "workspace",
        { page: 5, limit: 25, filter: "email", search: "course" },
        new AbortController().signal,
      ),
    ).text();
    expect(csv).toContain('"first-0"');
    expect(csv).toContain('"last"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"Course, ""quoted"""');
    expect(m.fetch).toHaveBeenCalledTimes(2);
    const declare = m.sql.mock.calls.find((call) =>
      call[0].startsWith("DECLARE"),
    );
    expect(declare?.[1]).toContain("workspace");
    expect(declare?.[1]).toContain("course");
    expect(m.end).toHaveBeenCalledOnce();
  });
  it("stops queries when the request is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await new Response(
      contactCsvStream(
        "workspace",
        { page: 1, limit: 25, filter: "all", search: "" },
        controller.signal,
      ),
    ).text();
    expect(m.connect).not.toHaveBeenCalled();
  });
});
