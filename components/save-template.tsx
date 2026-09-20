"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  campaignTemplateSchema,
  type TemplateConfig,
} from "@/lib/templates/saved-schema";

export default function SaveTemplate({
  defaultName,
  getConfig,
}: {
  defaultName: string;
  getConfig: () => TemplateConfig;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(false);
    const parsed = campaignTemplateSchema.safeParse({
      name,
      config: getConfig(),
    });
    if (!parsed.success) {
      setError(true);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/campaign-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error("Template save failed");
      setSaved(true);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {t(
            "Reuse these replies, buttons and follow-up settings in another campaign.",
          )}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${inputId}-form`}
          onClick={() => {
            setName(defaultName);
            setError(false);
            setSaved(false);
            setOpen(!open);
          }}
          className="shrink-0 rounded border border-border px-3 py-2 text-sm hover:bg-surface-hover"
        >
          {t("Save as template")}
        </button>
      </div>
      {saved && (
        <p role="status" className="text-sm text-success">
          {t("Template saved.")}{" "}
          <Link href="/campaign-templates" className="underline">
            {t("My templates")}
          </Link>
        </p>
      )}
      {open && (
        <form id={`${inputId}-form`} onSubmit={save} className="space-y-3">
          <label htmlFor={inputId} className="block text-sm font-medium">
            {t("Template name")}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-0 flex-1 rounded border border-border bg-surface px-3 py-2 text-sm"
            />
            <button
              disabled={saving}
              className="rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? t("Saving…") : t("Save template")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setOpen(false)}
              className="rounded border border-border px-3 py-2 text-sm"
            >
              {t("Cancel")}
            </button>
          </div>
          <p className="text-xs text-muted">
            {t(
              "Saves your current settings, including unsaved edits. Posts, accounts and analytics are excluded.",
            )}
          </p>
          {error && (
            <p role="alert" className="text-sm text-error">
              {t(
                "Could not save the template. Check the name, keywords and message settings, then try again.",
              )}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
