import { notFound } from "next/navigation";
import CampaignBuilder from "@/components/campaign-builder";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export default async function NewTemplatePage() {
  const context = await getCurrentWorkspaceContext();
  if (!context || !canManageWorkspace(context.role)) notFound();
  return <CampaignBuilder mode="template" />;
}
