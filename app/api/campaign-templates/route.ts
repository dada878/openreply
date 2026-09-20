import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { campaignTemplateSchema } from "@/lib/templates/saved-schema";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  // One extra row tells the creation menu whether to offer the full library.
  const templates = await prisma.campaignTemplate.findMany({
    where: { workspaceId: context.workspaceId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true },
    take: 6,
  });
  return NextResponse.json({
    success: true,
    data: templates.slice(0, 5),
    hasMore: templates.length > 5,
  });
}

async function mutate(request: NextRequest, method: "POST" | "PUT" | "DELETE") {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can manage templates" },
      { status: 403 },
    );
  }

  const id = request.nextUrl.searchParams.get("id");
  if (method !== "POST" && !id) {
    return NextResponse.json(
      { success: false, error: "Missing template ID" },
      { status: 400 },
    );
  }
  const where = { id: id ?? "", workspaceId: context.workspaceId };

  if (method === "DELETE") {
    const result = await prisma.campaignTemplate.deleteMany({ where });
    return result.count
      ? NextResponse.json({ success: true })
      : NextResponse.json(
          { success: false, error: "Template not found" },
          { status: 404 },
        );
  }

  const parsed = campaignTemplateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid template",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  if (method === "PUT") {
    // Keep the workspace predicate on the write itself, including concurrent deletes.
    const result = await prisma.campaignTemplate.updateMany({
      where,
      data: parsed.data,
    });
    return result.count
      ? NextResponse.json({ success: true })
      : NextResponse.json(
          { success: false, error: "Template not found" },
          { status: 404 },
        );
  }

  const template = await prisma.campaignTemplate.create({
    data: { ...parsed.data, workspaceId: context.workspaceId },
    select: { id: true },
  });
  return NextResponse.json({ success: true, data: template }, { status: 201 });
}

export async function POST(request: NextRequest) {
  return mutate(request, "POST");
}
export async function PUT(request: NextRequest) {
  return mutate(request, "PUT");
}
export async function DELETE(request: NextRequest) {
  return mutate(request, "DELETE");
}
