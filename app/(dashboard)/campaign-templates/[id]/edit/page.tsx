import { notFound } from "next/navigation";
import CampaignBuilder from "@/components/campaign-builder";
import { getSavedTemplate } from "@/lib/templates/saved";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getCurrentWorkspaceContext();
  if (!context || !canManageWorkspace(context.role)) notFound();
  const { id } = await params;
  const template = await getSavedTemplate(id, context.workspaceId);
  if (!template) notFound();
  return <CampaignBuilder key={id} mode="template" template={template} />;
}
