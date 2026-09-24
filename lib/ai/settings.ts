import { prisma } from "@/lib/db/client";
import { decryptToken } from "@/lib/meta/oauth";

export async function getWorkspaceAiSettings(workspaceId: string) {
  const saved = await prisma.aiConnection.findUnique({ where: { workspaceId } });
  return {
    apiKey: saved ? decryptToken(saved.apiKey) : process.env.OPENAI_API_KEY ?? null,
    defaultModel: saved?.defaultModel ?? process.env.OPENAI_MODEL ?? null,
    configured: Boolean(saved || process.env.OPENAI_API_KEY),
  };
}
