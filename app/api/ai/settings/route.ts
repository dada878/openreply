import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { encryptToken } from "@/lib/meta/oauth";
import { PUBLIC_REPLY_AI_MODELS } from "@/lib/ai/public-reply";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const modelValues = PUBLIC_REPLY_AI_MODELS.map((model) => model.value) as [string, ...string[]];
const settingsSchema = z.object({
  apiKey: z.union([z.string().trim().min(10).max(512), z.literal("")]).optional().transform((value) => value || undefined),
  defaultModel: z.enum(modelValues).optional(),
});

async function getContext() {
  const context = await getCurrentWorkspaceContext();
  if (!context) return { response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  if (!canManageWorkspace(context.role)) {
    return { response: NextResponse.json({ success: false, error: "Only owners and admins can manage AI settings" }, { status: 403 }) };
  }
  return { context };
}

export async function GET() {
  const result = await getContext();
  if (result.response) return result.response;
  const saved = await prisma.aiConnection.findUnique({ where: { workspaceId: result.context.workspaceId } });
  return NextResponse.json({
    success: true,
    data: {
      configured: Boolean(saved || process.env.OPENAI_API_KEY),
      source: saved ? "workspace" : process.env.OPENAI_API_KEY ? "environment" : null,
      defaultModel: saved?.defaultModel ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    },
  });
}

export async function PUT(request: Request) {
  const result = await getContext();
  if (result.response) return result.response;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid OpenAI settings", details: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await prisma.aiConnection.findUnique({ where: { workspaceId: result.context.workspaceId } });
  const encryptedApiKey = parsed.data.apiKey
    ? encryptToken(parsed.data.apiKey)
    : existing?.apiKey ?? (process.env.OPENAI_API_KEY ? encryptToken(process.env.OPENAI_API_KEY) : null);
  if (!encryptedApiKey) {
    return NextResponse.json({ success: false, error: "請先輸入 OpenAI API key。" }, { status: 400 });
  }
  const saved = await prisma.aiConnection.upsert({
    where: { workspaceId: result.context.workspaceId },
    create: {
      workspaceId: result.context.workspaceId,
      apiKey: encryptedApiKey,
      defaultModel: parsed.data.defaultModel ?? "gpt-4o-mini",
    },
    update: {
      apiKey: encryptedApiKey,
      ...(parsed.data.defaultModel ? { defaultModel: parsed.data.defaultModel } : {}),
    },
  });
  return NextResponse.json({ success: true, data: { configured: true, source: "workspace", defaultModel: saved.defaultModel ?? "gpt-4o-mini" } });
}

export async function DELETE() {
  const result = await getContext();
  if (result.response) return result.response;
  await prisma.aiConnection.deleteMany({ where: { workspaceId: result.context.workspaceId } });
  return NextResponse.json({ success: true, data: { configured: Boolean(process.env.OPENAI_API_KEY), source: process.env.OPENAI_API_KEY ? "environment" : null } });
}
