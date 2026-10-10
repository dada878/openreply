import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db/client";

export type Contact = {
  commenterId: string;
  commenterName: string | null;
  email: string | null;
  lastInteractionAt: string;
  campaigns: { id: string; name: string }[];
};
export type ContactFilter = "all" | "email";
export type ContactPage = {
  contacts: Contact[];
  counts: { all: number; email: number };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
export type ContactQuery = {
  page: number;
  limit: number;
  filter: ContactFilter;
  search: string;
};

function positiveInteger(value: string | null, fallback: number, max: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, max)
    : fallback;
}

export function parseContactQuery(params: URLSearchParams): ContactQuery {
  return {
    page: positiveInteger(params.get("page"), 1, 1_000_000),
    limit: positiveInteger(params.get("limit"), 25, 100),
    filter: params.get("filter") === "email" ? "email" : "all",
    search: (params.get("q") ?? "").trim().toLowerCase().slice(0, 200),
  };
}

type ContactRow = {
  contact: Contact | null;
  allCount: number;
  emailCount: number;
  total: number;
  page: number;
  totalPages: number;
};

function contactSourceSql(
  workspaceId: string,
  { filter, search }: ContactQuery,
) {
  const searchCondition = search
    ? Prisma.sql`AND (
    strpos(lower(COALESCE(c."commenterName", '')), ${search}) > 0
    OR strpos(lower(COALESCE(c.email, '')), ${search}) > 0
    OR strpos(lower(c."commenterId"), ${search}) > 0
    OR c."commenterId" IN (
      SELECT e."commenterId" FROM events e
      JOIN "Automation" a ON a.id = e."automationId" AND a."workspaceId" = ${workspaceId}
      WHERE strpos(lower(a.name), ${search}) > 0
    )
  )`
    : Prisma.empty;
  return Prisma.sql`
    WITH events AS (
      SELECT id, "commenterId", NULLIF("commenterName", '') AS "commenterName",
        NULL::text AS email, "dmSentAt" AS "interactionAt", "automationId", 0 AS priority
      FROM "DmLog"
      WHERE "workspaceId" = ${workspaceId} AND status = 'SENT' AND "dmSentAt" IS NOT NULL
      UNION ALL
      SELECT id, "commenterId", NULLIF("commenterName", ''), email, "capturedAt", "automationId", 1
      FROM "EmailCapture"
      WHERE "workspaceId" = ${workspaceId} AND "capturedAt" IS NOT NULL AND email IS NOT NULL AND email <> ''
    ), contacts AS (
      SELECT "commenterId", MAX("interactionAt") AS "lastInteractionAt",
        (array_agg("commenterName" ORDER BY priority, "interactionAt" DESC, id DESC)
          FILTER (WHERE "commenterName" IS NOT NULL))[1] AS "commenterName",
        (array_agg(email ORDER BY "interactionAt" DESC, id DESC)
          FILTER (WHERE email IS NOT NULL))[1] AS email
      FROM events GROUP BY "commenterId"
    ), filtered AS (
      SELECT c.* FROM contacts c
      WHERE ${filter === "email" ? Prisma.sql`c.email IS NOT NULL` : Prisma.sql`TRUE`}
      ${searchCondition}
    )
  `;
}

// Aggregate in Postgres before LIMIT so repeated campaign interactions cannot
// split a contact across pages. Only the requested page leaves the database.
export async function getContactPage(
  workspaceId: string,
  options: ContactQuery,
  db: Pick<typeof prisma, "$queryRaw"> = prisma,
): Promise<ContactPage> {
  const { page, limit } = options;
  const rows = await db.$queryRaw<ContactRow[]>(Prisma.sql`
    ${contactSourceSql(workspaceId, options)}, totals AS (
      SELECT (SELECT count(*)::int FROM contacts) AS "allCount",
        (SELECT count(*)::int FROM contacts WHERE email IS NOT NULL) AS "emailCount",
        count(*)::int AS total,
        ceil(count(*)::numeric / ${limit})::int AS "totalPages"
      FROM filtered
    ), bounds AS (
      SELECT *, LEAST(${page}, GREATEST(1, "totalPages"))::int AS page FROM totals
    ), paged AS (
      SELECT * FROM filtered ORDER BY "lastInteractionAt" DESC, "commenterId" ASC
      LIMIT ${limit} OFFSET (SELECT (page - 1) * ${limit} FROM bounds)
    ), campaigns AS (
      SELECT e."commenterId", jsonb_agg(DISTINCT jsonb_build_object('id', a.id, 'name', a.name)) AS campaigns
      FROM events e
      JOIN paged p ON p."commenterId" = e."commenterId"
      JOIN "Automation" a ON a.id = e."automationId" AND a."workspaceId" = ${workspaceId}
      GROUP BY e."commenterId"
    )
    SELECT b.*, CASE WHEN p."commenterId" IS NULL THEN NULL ELSE jsonb_build_object(
      'commenterId', p."commenterId", 'commenterName', p."commenterName", 'email', p.email,
      'lastInteractionAt', to_char(p."lastInteractionAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'campaigns', COALESCE(c.campaigns, '[]'::jsonb)
    ) END AS contact
    FROM bounds b LEFT JOIN paged p ON TRUE
    LEFT JOIN campaigns c ON c."commenterId" = p."commenterId"
    ORDER BY p."lastInteractionAt" DESC, p."commenterId" ASC
  `);
  const meta = rows[0];
  return {
    contacts: rows.flatMap((row) => (row.contact ? [row.contact] : [])),
    counts: { all: meta.allCount, email: meta.emailCount },
    pagination: {
      page: meta.page,
      limit,
      total: meta.total,
      totalPages: meta.totalPages,
    },
  };
}

// A server-side cursor executes this once and fetches bounded batches from one
// read-only snapshot, so new interactions cannot move contacts during export.
export function contactExportSql(workspaceId: string, options: ContactQuery) {
  return Prisma.sql`
    ${contactSourceSql(workspaceId, options)}, campaigns AS (
      SELECT e."commenterId", jsonb_agg(DISTINCT jsonb_build_object('id', a.id, 'name', a.name)) AS campaigns
      FROM events e
      JOIN filtered f ON f."commenterId" = e."commenterId"
      JOIN "Automation" a ON a.id = e."automationId" AND a."workspaceId" = ${workspaceId}
      GROUP BY e."commenterId"
    )
    SELECT f."commenterId", f."commenterName", f.email,
      to_char(f."lastInteractionAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "lastInteractionAt",
      COALESCE(c.campaigns, '[]'::jsonb) AS campaigns
    FROM filtered f LEFT JOIN campaigns c ON c."commenterId" = f."commenterId"
    ORDER BY f."lastInteractionAt" DESC, f."commenterId" ASC
  `;
}
