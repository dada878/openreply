"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/provider";
import { ContactsSkeleton, Skeleton } from "@/components/loading-skeleton";
import type { ContactFilter, ContactPage } from "@/lib/contacts/query";

function contactQueryOptions(
  filter: ContactFilter,
  search: string,
  page: number,
  limit: number,
) {
  return {
    queryKey: ["contacts", filter, search, page, limit] as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const params = new URLSearchParams({
        filter,
        q: search,
        page: String(page),
        limit: String(limit),
      });
      const response = await fetch(`/api/contacts?${params}`, {
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.error ?? "Failed to load contacts");
      return payload.data as ContactPage;
    },
  };
}

export default function ContactsPage() {
  const { t, locale } = useI18n();
  const client = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [searchPage, setSearchPage] = useState({ search: "", page: 1 });
  const [limit, setLimit] = useState(25);
  const { search, page } = searchPage;
  const normalizedQuery = query.trim().toLowerCase();
  useEffect(() => {
    if (normalizedQuery === search) return;
    const timer = setTimeout(
      () => setSearchPage({ search: normalizedQuery, page: 1 }),
      300,
    );
    return () => clearTimeout(timer);
  }, [normalizedQuery, search]);
  const result = useQuery({
    ...contactQueryOptions(filter, search, page, limit),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === filter &&
      previousQuery.queryKey[2] === search
        ? previous
        : undefined,
  });
  const { data } = result;
  const contacts = data?.contacts ?? [];
  const pagination = data?.pagination;
  // Cache the next page after the current one arrives; tab/search keys stay separate.
  useEffect(() => {
    if (
      data &&
      !result.isPlaceholderData &&
      data.pagination.page < data.pagination.totalPages
    ) {
      void client.prefetchQuery(
        contactQueryOptions(filter, search, data.pagination.page + 1, limit),
      );
    }
  }, [client, data, filter, search, limit, result.isPlaceholderData]);

  function changeFilter(next: ContactFilter) {
    setFilter(next);
    setSearchPage({ search: normalizedQuery, page: 1 });
  }
  if (result.isLoading && !data && !search && filter === "all" && page === 1)
    return <ContactsSkeleton />;
  const exportParams = new URLSearchParams({
    format: "csv",
    filter,
    q: search,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {t("Contacts")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "All Instagram contacts from your campaigns. Emails are shown when collected.",
            )}
          </p>
        </div>
        <a
          href={`/api/contacts?${exportParams}`}
          aria-disabled={!pagination?.total}
          onClick={(event) => {
            if (!pagination?.total) event.preventDefault();
          }}
          className="rounded border border-border px-3 py-2 text-sm text-muted hover:text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {t("Download contacts")}
        </a>
      </div>

      <div className="panel rounded p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex w-full items-center gap-1 rounded-lg border border-border bg-surface p-1 sm:w-auto"
            role="tablist"
            aria-label={t("Contact filters")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              onClick={() => changeFilter("all")}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                filter === "all"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("All contacts")}{" "}
              <span className="ml-1 opacity-70">{data?.counts.all ?? "—"}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "email"}
              onClick={() => changeFilter("email")}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                filter === "email"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("With email")}{" "}
              <span className="ml-1 opacity-70">
                {data?.counts.email ?? "—"}
              </span>
            </button>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t("Search contacts")}
            placeholder={t("Search contacts")}
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none sm:w-72"
          />
        </div>

        {result.isError && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded border border-red-500/30 p-3 text-sm"
          >
            <span>{t("Could not load contacts. Please retry.")}</span>
            <button
              type="button"
              onClick={() => result.refetch()}
              className="underline"
            >
              {t("Retry")}
            </button>
          </div>
        )}
        <p className="mb-4 text-sm text-muted" aria-live="polite">
          {pagination
            ? t("{count} contacts", { count: pagination.total })
            : "—"}
          {result.isFetching && <span className="ml-2">{t("Updating…")}</span>}
        </p>

        {result.isLoading ? (
          <div
            className="overflow-x-auto"
            aria-busy="true"
            aria-label={t("Loading contacts")}
          >
            <div className="min-w-[720px] space-y-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-4 gap-4 border-b border-border px-3 py-3"
                >
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : contacts.length === 0 && !result.isError ? (
          <p className="py-8 text-center text-sm text-muted">
            {filter === "email"
              ? t("No contacts with email yet")
              : t("No contacts yet")}
          </p>
        ) : (
          <div
            className={`overflow-x-auto transition-opacity ${result.isPlaceholderData ? "opacity-60" : ""}`}
            aria-busy={result.isFetching}
          >
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("Email")}</th>
                  <th className="px-3 py-2 font-medium">
                    {t("Instagram username")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("Source campaigns")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("Last interaction")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.commenterId}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-3 py-3 text-foreground">
                      {contact.email ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-foreground">
                      {contact.commenterName
                        ? `@${contact.commenterName}`
                        : contact.commenterId}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {contact.campaigns.map((campaign) => (
                          <Link
                            key={campaign.id}
                            href={`/campaigns/${campaign.id}`}
                            className="text-accent hover:underline"
                          >
                            {campaign.name}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {new Date(contact.lastInteractionAt).toLocaleString(
                        locale,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted">
            <span>
              {t("Showing {start}–{end} of {total}", {
                start: pagination.total
                  ? (pagination.page - 1) * pagination.limit + 1
                  : 0,
                end: Math.min(
                  pagination.page * pagination.limit,
                  pagination.total,
                ),
                total: pagination.total,
              })}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                {t("Rows per page")}
                <select
                  value={limit}
                  onChange={(event) => {
                    setLimit(Number(event.target.value));
                    setSearchPage({ search, page: 1 });
                  }}
                  className="rounded border border-border bg-surface px-2 py-1.5 text-foreground"
                >
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pagination.page <= 1 || result.isPlaceholderData}
                onClick={() =>
                  setSearchPage({ search, page: pagination.page - 1 })
                }
                className="rounded border border-border px-3 py-1.5 disabled:opacity-40"
              >
                {t("Previous")}
              </button>
              <span>
                {pagination.page} / {Math.max(1, pagination.totalPages)}
              </span>
              <button
                type="button"
                disabled={
                  pagination.page >= pagination.totalPages ||
                  result.isPlaceholderData
                }
                onClick={() =>
                  setSearchPage({ search, page: pagination.page + 1 })
                }
                className="rounded border border-border px-3 py-1.5 disabled:opacity-40"
              >
                {t("Next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
