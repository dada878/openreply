"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Trash2, Pencil, LoaderCircle } from "lucide-react";
import AutoResizeTextarea from "@/components/auto-resize-textarea";
import { Skeleton } from "@/components/loading-skeleton";
import { useI18n } from "@/lib/i18n/provider";
import type { FollowUpSettings } from "@/lib/follow-ups/schema";

type Item = FollowUpSettings & { id: string; counts: Record<string, number> };
const blankVariant = () => ({
  name: "",
  message: "",
  destinationUrl: "",
  buttonLabel: "",
});
const blank = (): FollowUpSettings => ({
  name: "",
  variants: [blankVariant()],
  delayMinutes: 3,
  isActive: false,
  allowRepeat: false,
  selectionMode: "RANDOM",
});
const field =
  "w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent";

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function FollowUpsPage() {
  const { t } = useI18n();
  const client = useQueryClient();
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState<FollowUpSettings>(blank);
  const query = useQuery<{ items: Item[]; canManage: boolean }>({
    queryKey: ["shared-follow-ups"],
    queryFn: () => request("/api/follow-ups"),
    refetchInterval: 30_000,
  });
  const mutation = useMutation({
    mutationFn: ({
      method,
      id,
      data,
    }: {
      method: string;
      id?: string;
      data?: FollowUpSettings;
    }) =>
      request(`/api/follow-ups${id ? `?id=${encodeURIComponent(id)}` : ""}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["shared-follow-ups"] });
      setEditing(undefined);
    },
  });
  function edit(item?: Item) {
    mutation.reset();
    setDraft(
      item
        ? { ...item, variants: item.variants.map((v) => ({ ...v })) }
        : blank(),
    );
    setEditing(item?.id ?? null);
  }
  function variant(
    index: number,
    patch: Partial<FollowUpSettings["variants"][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t("Shared follow-ups")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {t(
              "Promote your courses, services or products after a resource is delivered.",
            )}
          </p>
        </div>
        {query.data?.canManage && editing === undefined && (
          <button
            onClick={() => edit()}
            className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm text-white"
          >
            <Plus size={16} />
            {t("New follow-up")}
          </button>
        )}
      </div>
      <div className="rounded border border-border bg-surface p-4 text-sm text-muted space-y-2">
        <p>
          {t(
            "Applies to all current and future campaigns in this workspace. One shared follow-up can be active at a time; it replaces campaign-specific follow-ups.",
          )}
        </p>
        <p>
          {t(
            "Timing starts after successful resource delivery. A recent DM or message-button interaction is required; a comment or read receipt alone is not enough.",
          )}
        </p>
      </div>
      {query.isLoading && (
        <div
          aria-label={t("Loading follow-ups")}
          aria-busy="true"
          className="space-y-3"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded border border-border p-5 space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-40" />
            </div>
          ))}
        </div>
      )}
      {query.isError && (
        <div role="alert" className="rounded border border-red-500/40 p-4">
          <p>{t("Could not load follow-ups.")}</p>
          <button onClick={() => query.refetch()} className="mt-2 underline">
            {t("Retry")}
          </button>
        </div>
      )}
      {mutation.isError && (
        <p role="alert" className="text-red-500">
          {t("Could not save follow-up. Please retry.")}
        </p>
      )}
      {editing !== undefined && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({
              method: editing ? "PUT" : "POST",
              id: editing || undefined,
              data: draft,
            });
          }}
          className="rounded border border-border bg-surface p-5 sm:p-6 space-y-5"
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium">{t("Follow-up name")} *</span>
            <input
              required
              maxLength={100}
              className={field}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t("Delay after delivery (minutes)")}
              </span>
              <input
                type="number"
                required
                min={1}
                max={1440}
                className={field}
                value={draft.delayMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, delayMinutes: Number(e.target.value) })
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                {t("Content selection")}
              </span>
              <select
                className={field}
                value={draft.selectionMode}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    selectionMode: e.target
                      .value as FollowUpSettings["selectionMode"],
                  })
                }
              >
                <option value="RANDOM">{t("Random")}</option>
                <option value="SEQUENTIAL">{t("Rotate in order")}</option>
              </select>
            </label>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              role="switch"
              className="mt-1 accent-accent"
              checked={draft.allowRepeat}
              onChange={(e) =>
                setDraft({ ...draft, allowRepeat: e.target.checked })
              }
            />
            <span>
              <span className="font-medium">
                {t("Allow repeat promotions")}
              </span>
              <span className="mt-1 block text-muted">
                {t(
                  "Off: once per person per Instagram account. On: after each completed resource delivery. Duplicate events never send twice.",
                )}
              </span>
            </span>
          </label>
          <div className="space-y-4">
            {draft.variants.map((item, index) => (
              <fieldset
                key={index}
                className="rounded border border-border p-4 space-y-4"
              >
                <legend className="px-2 text-sm font-medium">
                  {t("Promotion content")} {index + 1}
                </legend>
                <label className="block space-y-2">
                  <span className="text-sm">
                    {t("Product or variant name")} *
                  </span>
                  <input
                    required
                    maxLength={100}
                    className={field}
                    value={item.name}
                    onChange={(e) => variant(index, { name: e.target.value })}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm">{t("Message")} *</span>
                  <AutoResizeTextarea
                    required
                    maxLength={1000}
                    className={field}
                    value={item.message}
                    onChange={(e) =>
                      variant(index, { message: e.target.value })
                    }
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm">
                      {t("Destination URL (optional)")}
                    </span>
                    <input
                      type="url"
                      pattern="https?://.*"
                      className={field}
                      placeholder="https://"
                      value={item.destinationUrl}
                      onChange={(e) =>
                        variant(index, { destinationUrl: e.target.value })
                      }
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm">{t("Button label")}</span>
                    <input
                      maxLength={20}
                      className={field}
                      value={item.buttonLabel}
                      placeholder={t("Open link")}
                      onChange={(e) =>
                        variant(index, { buttonLabel: e.target.value })
                      }
                    />
                  </label>
                </div>
                {draft.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        variants: draft.variants.filter((_, i) => i !== index),
                      })
                    }
                    className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
                  >
                    <Trash2 size={14} />
                    {t("Remove content")}
                  </button>
                )}
              </fieldset>
            ))}
          </div>
          <button
            type="button"
            disabled={draft.variants.length >= 10}
            onClick={() =>
              setDraft({
                ...draft,
                variants: [...draft.variants, blankVariant()],
              })
            }
            className="inline-flex items-center gap-2 text-sm disabled:opacity-40"
          >
            <Plus size={16} />
            {t("Add content variant or product")}
          </button>
          <p className="text-xs text-muted">
            {t(
              "Random chooses one entry per delivery and may repeat. Rotation follows the list for each recipient. Queued deliveries keep their selected content and scheduled time.",
            )}
          </p>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              role="switch"
              className="accent-accent"
              checked={draft.isActive}
              onChange={(e) =>
                setDraft({ ...draft, isActive: e.target.checked })
              }
            />
            {t("Enable this follow-up")}
          </label>
          <p className="text-xs text-muted">
            {t(
              "Enabling replaces the previous active promotion. Pausing cancels pending deliveries; messages already being sent cannot be recalled.",
            )}
          </p>
          <div className="flex gap-3">
            <button
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {mutation.isPending && (
                <LoaderCircle size={16} className="animate-spin" />
              )}
              {t("Save")}
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => setEditing(undefined)}
              className="rounded border border-border px-4 py-2 text-sm"
            >
              {t("Cancel")}
            </button>
          </div>
        </form>
      )}
      {!query.isLoading &&
        !query.isError &&
        !query.data?.items.length &&
        editing === undefined && (
          <div className="rounded border border-dashed border-border py-14 text-center">
            <Send className="mx-auto mb-3 text-muted" />
            <p>{t("Create your first shared follow-up")}</p>
            <p className="mt-2 text-sm text-muted">
              {t(
                "Name it, add your offer, and send it three minutes after resource delivery.",
              )}
            </p>
          </div>
        )}
      <div className="space-y-3">
        {query.data?.items.map((item) => (
          <article
            key={item.id}
            className="rounded border border-border bg-surface p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p className="mt-1 text-sm text-muted">
                  {item.isActive ? t("Active") : t("Paused")} ·{" "}
                  {item.delayMinutes} {t("minutes")} ·{" "}
                  {item.selectionMode === "RANDOM"
                    ? t("Random")
                    : t("Rotate in order")}{" "}
                  ·{" "}
                  {item.allowRepeat
                    ? t("Repeats allowed")
                    : t("Once per person")}
                </p>
              </div>
              {query.data.canManage && (
                <div className="flex items-start gap-3">
                  <button
                    aria-label={`${t("Edit")} ${item.name}`}
                    disabled={mutation.isPending}
                    onClick={() => edit(item)}
                    className="rounded border border-border p-2"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        method: "PUT",
                        id: item.id,
                        data: { ...item, isActive: !item.isActive },
                      })
                    }
                    className="rounded border border-border px-3 py-2 text-sm"
                  >
                    {item.isActive ? t("Pause") : t("Enable")}
                  </button>
                  <button
                    disabled={mutation.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          t(
                            "Archive this follow-up and cancel pending deliveries?",
                          ),
                        )
                      )
                        mutation.mutate({ method: "DELETE", id: item.id });
                    }}
                    className="rounded border border-border px-3 py-2 text-sm"
                  >
                    {t("Archive")}
                  </button>
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {item.variants.map((v, i) => (
                <div key={i} className="rounded bg-background p-3">
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted">
                    {v.message}
                  </p>
                  {v.destinationUrl && (
                    <p className="mt-2 truncate text-xs text-muted">
                      {v.destinationUrl}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              {t("Pending")}: {item.counts.PENDING || 0} · {t("Sent")}:{" "}
              {item.counts.SENT || 0} · {t("No messaging window")}:{" "}
              {item.counts.SKIPPED_WINDOW || 0} · {t("Failed")}:{" "}
              {item.counts.FAILED || 0} · {t("Delivery unconfirmed")}:{" "}
              {(item.counts.UNCONFIRMED || 0) + (item.counts.SENDING || 0)} ·{" "}
              {t("Cancelled")}: {item.counts.CANCELLED || 0} · {t("Plan limit")}
              : {item.counts.SKIPPED_LIMIT || 0}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
