import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { followUpSchema } from "@/lib/follow-ups/schema";

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.sharedFollowUp.findMany({
    where: { workspaceId: context.workspaceId, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deliveries: true } } },
  });
  const counts = await prisma.sharedFollowUpDelivery.groupBy({
    by: ["followUpId", "status"],
    where: { followUp: { workspaceId: context.workspaceId, archivedAt: null } },
    _count: { _all: true },
  });
  return NextResponse.json(
    {
      items: items.map((item) => ({
        ...item,
        counts: Object.fromEntries(
          counts
            .filter((row) => row.followUpId === item.id)
            .map((row) => [row.status, row._count._all]),
        ),
      })),
      canManage: canManageWorkspace(context.role),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  return save(request);
}
export async function PUT(request: NextRequest) {
  return save(request);
}

async function save(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(context.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = followUpSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid follow-up settings" },
      { status: 400 },
    );
  const id = request.nextUrl.searchParams.get("id");
  if (request.method === "PUT" && !id)
    return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  const data = parsed.data;
  try {
    const item = await prisma.$transaction(async (tx) => {
      // Serialize activation changes across requests, including different saved promotions.
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${context.workspaceId} FOR UPDATE`;
      if (
        id &&
        !(await tx.sharedFollowUp.findFirst({
          where: { id, workspaceId: context.workspaceId, archivedAt: null },
        }))
      )
        return null;
      if (data.isActive) {
        await tx.sharedFollowUp.updateMany({
          where: {
            workspaceId: context.workspaceId,
            isActive: true,
            ...(id ? { id: { not: id } } : {}),
          },
          data: { isActive: false },
        });
        await tx.sharedFollowUpDelivery.updateMany({
          where: {
            status: "PENDING",
            followUp: { workspaceId: context.workspaceId },
            ...(id ? { followUpId: { not: id } } : {}),
          },
          data: {
            status: "CANCELLED",
            errorMessage: "A different promotion was activated",
          },
        });
      } else if (id) {
        await tx.sharedFollowUpDelivery.updateMany({
          where: { followUpId: id, status: "PENDING" },
          data: { status: "CANCELLED", errorMessage: "Promotion paused" },
        });
      }
      return id
        ? tx.sharedFollowUp.update({ where: { id }, data })
        : tx.sharedFollowUp.create({
            data: { ...data, workspaceId: context.workspaceId },
          });
    });
    return item
      ? NextResponse.json({ item })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "Could not save follow-up. Please retry." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(context.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${context.workspaceId} FOR UPDATE`;
    const row = await tx.sharedFollowUp.updateMany({
      where: { id, workspaceId: context.workspaceId, archivedAt: null },
      data: { isActive: false, archivedAt: new Date() },
    });
    if (row.count)
      await tx.sharedFollowUpDelivery.updateMany({
        where: { followUpId: id, status: "PENDING" },
        data: { status: "CANCELLED", errorMessage: "Promotion archived" },
      });
    return row;
  });
  return NextResponse.json(
    { success: result.count > 0 },
    { status: result.count ? 200 : 404 },
  );
}
