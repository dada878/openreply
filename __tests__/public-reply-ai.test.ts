import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePublicReply } from "@/lib/ai/public-reply";

describe("generatePublicReply", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
    if (originalBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = originalBaseUrl;
  });

  it("does not call the provider when no API key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generatePublicReply({
        prompt: "Say hello",
        username: "dada",
        displayName: "Dada",
        commentText: "hello",
        accountUsername: "openreply",
        existingReply: "Thanks!",
      }),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the configured context and returns clean reply text", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
    process.env.OPENAI_BASE_URL = "https://ai.example.test/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "```text\n嗨 {username}！```" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generatePublicReply({
        prompt: "用繁體中文稱呼 {display_name}，參考留言：{comment}",
        model: "gpt-4.1-mini",
        username: "dada",
        displayName: "Dada",
        commentText: "想了解 AI",
        accountUsername: "openreply",
        existingReply: "已私訊你！",
      }),
    ).resolves.toBe("嗨 {username}！");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ai.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.messages[1].content).toContain("Dada");
    expect(body.messages[1].content).toContain("想了解 AI");
  });
});
