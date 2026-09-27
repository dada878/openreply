"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { useInstagramCredentials } from "@/lib/instagram/credential-query";

export function CampaignCredentialSelect({
  accountId,
  value,
  onChange,
}: {
  accountId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const query = useInstagramCredentials(Boolean(accountId));
  const choices =
    query.data?.filter(
      (credential) => credential.instagramAccountId === accountId,
    ) ?? [];
  return (
    <div className="space-y-2 pt-2">
      <label htmlFor="campaign-credential" className="text-sm font-semibold">
        {t("Instagram API credential")}
      </label>
      <select
        id="campaign-credential"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={query.isPending || query.isError}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
      >
        <option value="">{t("Account default connection")}</option>
        {value && !choices.some((credential) => credential.id === value) && (
          <option value={value}>{t("Selected credential unavailable")}</option>
        )}
        {choices.map((credential) => (
          <option key={credential.id} value={credential.id}>
            {credential.name} · App {credential.appId}
          </option>
        ))}
      </select>
      <p className="text-xs leading-5 text-muted">
        {t(
          "This campaign uses the selected credential for replies. Other campaigns keep their own selection.",
        )}{" "}
        <Link
          className="text-accent hover:underline"
          href="/settings#instagram-credentials-title"
        >
          {t("Manage credentials")}
        </Link>
      </p>
      {query.error && (
        <p role="alert" className="text-xs text-error">
          {query.error.message}
        </p>
      )}
    </div>
  );
}
