import "server-only";
import { prisma } from "@/lib/db/client";
import { campaignTemplateSchema } from "./saved-schema";

export async function getSavedTemplate(id: string, workspaceId: string) {
  const template = await prisma.campaignTemplate.findFirst({
    where: { id, workspaceId },
  });
  return template
    ? { id: template.id, ...campaignTemplateSchema.parse(template) }
    : null;
}
