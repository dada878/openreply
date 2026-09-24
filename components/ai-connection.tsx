"use client";

import { useI18n } from "@/lib/i18n/provider";
import { PUBLIC_REPLY_AI_MODELS } from "@/lib/ai/public-reply";
import { useEffect, useState } from "react";

type AiSettings = {
  configured: boolean;
  source: "workspace" | "environment" | null;
  defaultModel?: string | null;
};

export function AiConnection({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const [data, setData] = useState<AiSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("gpt-4o-mini");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/ai/settings", { cache: "no-store" });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    setData(result.data);
    setDefaultModel(result.data.defaultModel ?? "gpt-4o-mini");
  }

  useEffect(() => {
    // Loading settings is an external synchronization; the response hydrates
    // the form after the initial render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (canManage) void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : t("Could not load connection.")));
  }, [canManage, t]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, defaultModel }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setApiKey("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not update connection."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("確定要移除這個工作區的 OpenAI API key 嗎？")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/settings", { method: "DELETE" });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not update connection."));
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return <section className="panel rounded p-4 sm:p-6"><h2 className="text-base font-semibold">AI 公開回覆</h2><p className="mt-2 text-sm text-muted">請聯絡工作區擁有者或管理員設定 OpenAI API key。</p></section>;
  }

  return (
    <section className="panel rounded p-4 sm:p-6" aria-labelledby="ai-connection-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="ai-connection-heading" className="text-base font-semibold">AI 公開回覆</h2>
          <p className="mt-1 text-sm text-muted">設定後，活動可以用 AI 生成公開留言回覆。</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${data?.configured ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
          {data?.configured ? "已設定" : "尚未設定"}
        </span>
      </div>
      {error && <p role="alert" className="mt-4 rounded border border-error/30 bg-surface p-3 text-sm text-error">{error}</p>}
      <div className="mt-5 space-y-3">
        <label className="block text-sm font-medium" htmlFor="openai-api-key">OpenAI API key</label>
        <input
          id="openai-api-key"
          type="password"
          autoComplete="new-password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={data?.configured ? "已設定；輸入新 key 可替換" : "sk-..."}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted"
        />
        <p className="text-xs leading-5 text-muted">API key 會以加密形式儲存在此工作區，頁面不會再次顯示完整 key。</p>
        <label className="block text-sm font-medium" htmlFor="openai-default-model">預設模型</label>
        <select id="openai-default-model" value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
          {PUBLIC_REPLY_AI_MODELS.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
        </select>
        <div className="flex flex-wrap gap-3 pt-1">
          <button type="button" disabled={busy || (!apiKey.trim() && !data?.configured)} onClick={() => void save()} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">{busy ? "儲存中…" : data?.configured ? "儲存 AI 設定" : "儲存 API key"}</button>
          {data?.source === "workspace" && <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg border border-error/30 px-4 py-2 text-sm font-medium text-error hover:bg-error/10 disabled:opacity-50">移除 workspace key</button>}
        </div>
      </div>
    </section>
  );
}
