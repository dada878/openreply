import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generatePublicReply,
  PUBLIC_REPLY_AI_MODELS,
} from "@/lib/ai/public-reply";
import { getWorkspaceAiSettings } from "@/lib/ai/settings";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const modelValues = PUBLIC_REPLY_AI_MODELS.map((model) => model.value) as [string, ...string[]];
const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  model: z.enum(modelValues).optional(),
  username: z.string().max(120).optional().default("commenter"),
  displayName: z.string().max(120).optional().default("留言者"),
  commentText: z.string().max(1000).optional().default(""),
  accountUsername: z.string().max(120).optional().default("yourbrand"),
  existingReply: z.string().max(1000).optional().default("謝謝你的留言！"),
});

export async function POST(request: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageWorkspace(context.role)) {
    return NextResponse.json({ success: false, error: "Only owners and admins can test AI replies" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid AI test input", details: parsed.error.flatten() }, { status: 400 });
  }
  const aiSettings = await getWorkspaceAiSettings(context.workspaceId);
  if (!aiSettings.apiKey) {
    return NextResponse.json({ success: false, error: "請先在 Zeabur 設定 OPENAI_API_KEY。" }, { status: 503 });
  }

  try {
    const reply = await generatePublicReply({
      prompt: parsed.data.prompt,
      apiKey: aiSettings.apiKey,
      model: parsed.data.model ?? aiSettings.defaultModel,
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      commentText: parsed.data.commentText,
      accountUsername: parsed.data.accountUsername,
      existingReply: parsed.data.existingReply,
    });
    if (!reply) {
      return NextResponse.json({ success: false, error: "AI 沒有產生可用的回覆。" }, { status: 502 });
    }
    return NextResponse.json({ success: true, data: { reply } });
  } catch (error) {
    console.error("[AI public reply test] failed", error);
    return NextResponse.json({ success: false, error: "AI 生成失敗，請稍後再試。" }, { status: 502 });
  }
}
