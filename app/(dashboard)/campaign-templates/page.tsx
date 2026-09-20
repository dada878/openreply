import { redirect } from "next/navigation";
import TemplateLibrary from "@/components/template-library";
import { prisma } from "@/lib/db/client";
import { campaignTemplateSchema } from "@/lib/templates/saved-schema";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export default async function TemplatesPage() {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/login");
  const rows = await prisma.campaignTemplate.findMany({
    where: { workspaceId: context.workspaceId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  const templates = rows.map((row) => ({
    id: row.id,
    ...campaignTemplateSchema.parse(row),
  }));
  return (
    <TemplateLibrary
      templates={templates}
      canManage={canManageWorkspace(context.role)}
    />
  );
}
