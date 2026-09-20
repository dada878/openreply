"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import type { SavedCampaignTemplate } from "@/lib/templates/saved-schema";

export default function TemplateLibrary({
  templates,
  canManage,
}: {
  templates: SavedCampaignTemplate[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  async function remove(id: string) {
    setDeleting(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/campaign-templates?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Template deletion failed");
      setConfirmId(null);
      startTransition(() => router.refresh());
    } catch {
      setError(true);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = templates.filter((template) =>
    template.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-xl font-semibold">{t("My templates")}</h2>
          <p className="text-sm text-muted">
            {t(
              "Save a reply flow once, then reuse it for your next post. Templates are shared with your workspace.",
            )}
          </p>
        </div>
        {canManage && (
          <Link
            href="/campaign-templates/new"
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            {t("New template")}
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          {t("Could not delete the template. Please try again.")}
        </p>
      )}
      {templates.length > 0 && (
        <input
          type="search"
          aria-label={t("Search templates")}
          placeholder={t("Search templates")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm"
        />
      )}
      {templates.length === 0 ? (
        <div className="panel rounded p-8 text-center space-y-3">
          <h3 className="font-medium">
            {t("Your reusable reply flows will appear here")}
          </h3>
          <p className="text-sm text-muted">
            {t(
              "Create a template here, or choose Save as template in any campaign editor.",
            )}
          </p>
          <Link
            href="/campaigns"
            className="inline-block text-sm text-accent underline"
          >
            {t("Back to campaigns")}
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">
          {t("No templates match your search.")}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ id, name, config }) => (
            <article
              key={id}
              className="panel flex min-w-0 flex-col rounded-lg p-5 space-y-4"
            >
              <h3 className="break-words font-semibold">{name}</h3>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded bg-surface-hover px-2 py-1">
                  {config.matchAnyWord
                    ? t("Any word")
                    : config.keywords.join(", ")}
                </span>
                {config.requireFollow && (
                  <span className="rounded bg-surface-hover px-2 py-1">
                    {t("Require follow")}
                  </span>
                )}
                {config.followUpEnabled && (
                  <span className="rounded bg-surface-hover px-2 py-1">
                    {t("Follow-up")}
                  </span>
                )}
              </div>
              <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted">
                {config.dmMessage}
              </p>
              {canManage && (
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Link
                    href={`/campaigns/new?savedTemplate=${encodeURIComponent(id)}`}
                    className="rounded bg-accent px-3 py-2 text-sm text-white"
                  >
                    {t("Use template")}
                  </Link>
                  <Link
                    href={`/campaign-templates/${encodeURIComponent(id)}/edit`}
                    className="rounded border border-border px-3 py-2 text-sm"
                  >
                    {t("Edit")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmId(id);
                      setError(false);
                    }}
                    className="rounded border border-border px-3 py-2 text-sm text-muted"
                  >
                    {t("Delete")}
                  </button>
                </div>
              )}
              {confirmId === id && (
                <div className="space-y-3 rounded border border-error/30 p-3">
                  <p className="text-sm">
                    {t(
                      "Delete this template? Campaigns already created from it will keep their settings.",
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deleting || refreshing}
                      onClick={() => remove(id)}
                      className="rounded bg-error px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {t("Delete template")}
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmId(null)}
                      className="rounded border border-border px-3 py-2 text-sm"
                    >
                      {t("Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
