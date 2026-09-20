import CampaignBuilder from "@/components/campaign-builder";
import { notFound } from "next/navigation";
import { getSavedTemplate } from "@/lib/templates/saved";
import { getCurrentWorkspaceContext } from "@/lib/workspace-access";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{
    savedTemplate?: string | string[];
    import?: string | string[];
  }>;
}) {
  const { savedTemplate, import: importSource } = await searchParams;
  if (!savedTemplate)
    return (
      <CampaignBuilder
        key={importSource === "csv" ? "csv" : "blank"}
        mode="new"
        allowImportQueue={importSource === "csv"}
      />
    );
  if (typeof savedTemplate !== "string") notFound();
  const context = await getCurrentWorkspaceContext();
  if (!context) notFound();
  const template = await getSavedTemplate(savedTemplate, context.workspaceId);
  if (!template) notFound();
  return <CampaignBuilder key={template.id} mode="new" template={template} />;
}
