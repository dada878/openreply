"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n/provider";
import { ContactsSkeleton } from "@/components/loading-skeleton";

type Contact = {
  commenterId: string;
  commenterName: string | null;
  email: string | null;
  lastInteractionAt: string;
  campaigns: { id: string; name: string }[];
};

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function ContactsPage() {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "email">("all");
  const { data: contacts = [], isLoading: loading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const response = await fetch("/api/contacts", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to load contacts");
      return payload.data as Contact[];
    },
  });

  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = filter === "email" ? contacts.filter((contact) => Boolean(contact.email)) : contacts;
    if (!normalized) return filtered;
    return filtered.filter((contact) =>
      [
        contact.email ?? "",
        contact.commenterName ?? "",
        contact.commenterId,
        ...contact.campaigns.map((campaign) => campaign.name),
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [contacts, filter, query]);

  if (loading) {
    return <ContactsSkeleton />;
  }

  function downloadContacts() {
    const rows = [
      ["email", "instagram_username", "instagram_id", "campaigns", "last_interaction_at"],
      ...visibleContacts.map((contact) => [
        contact.email ?? "",
        contact.commenterName ?? "",
        contact.commenterId,
        contact.campaigns.map((campaign) => campaign.name).join("; "),
        contact.lastInteractionAt,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "openreply-contacts.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{t("Contacts")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("All Instagram contacts from your campaigns. Emails are shown when collected.")}
          </p>
        </div>
        <button
          type="button"
          disabled={visibleContacts.length === 0}
          onClick={downloadContacts}
          className="rounded border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("Download contacts")}
        </button>
      </div>

      <div className="panel rounded p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-1 rounded-lg border border-border bg-surface p-1 sm:w-auto" role="tablist" aria-label={t("Contact filters")}>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              onClick={() => setFilter("all")}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                filter === "all" ? "bg-foreground text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {t("All contacts")} <span className="ml-1 opacity-70">{contacts.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "email"}
              onClick={() => setFilter("email")}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                filter === "email" ? "bg-foreground text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {t("With email")} <span className="ml-1 opacity-70">{contacts.filter((contact) => Boolean(contact.email)).length}</span>
            </button>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search contacts")}
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none sm:w-72"
          />
        </div>

        <p className="mb-4 text-sm text-muted">
          {t("{count} contacts", { count: visibleContacts.length })}
        </p>

        {visibleContacts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {filter === "email" ? t("No contacts with email yet") : t("No contacts yet")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("Email")}</th>
                  <th className="px-3 py-2 font-medium">{t("Instagram username")}</th>
                  <th className="px-3 py-2 font-medium">{t("Source campaigns")}</th>
                  <th className="px-3 py-2 font-medium">{t("Last interaction")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleContacts.map((contact) => (
                  <tr key={contact.commenterId} className="border-b border-border/70 last:border-0">
                    <td className="px-3 py-3 text-foreground">{contact.email ?? "—"}</td>
                    <td className="px-3 py-3 text-foreground">
                      {contact.commenterName ? `@${contact.commenterName}` : contact.commenterId}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {contact.campaigns.map((campaign) => (
                          <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="text-accent hover:underline">
                            {campaign.name}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted">
                      {new Date(contact.lastInteractionAt).toLocaleString(locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
