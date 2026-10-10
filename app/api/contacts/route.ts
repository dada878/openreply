import { NextRequest, NextResponse } from "next/server";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";
import { getContactPage, parseContactQuery } from "@/lib/contacts/query";
import { contactCsvStream } from "@/lib/contacts/export";

export const dynamic = "force-dynamic";

// Contact identities and email addresses are restricted to owners and admins.
export async function GET(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  if (!canManageWorkspace(context.role))
    return NextResponse.json(
      { success: false, error: "Only owners and admins can view contacts" },
      { status: 403 },
    );
  const options = parseContactQuery(request.nextUrl.searchParams);
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new Response(
      contactCsvStream(context.workspaceId, options, request.signal),
      {
        headers: {
          "Content-Type": "text/csv;charset=utf-8",
          "Content-Disposition":
            'attachment; filename="openreply-contacts.csv"',
          "Cache-Control": "no-store",
        },
      },
    );
  }
  try {
    const data = await getContactPage(context.workspaceId, options);
    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Contacts] Failed to load page", error);
    return NextResponse.json(
      { success: false, error: "Failed to load contacts" },
      { status: 500 },
    );
  }
}
