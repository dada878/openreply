"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LoaderCircle, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import {
  credentialQueryKey,
  useInstagramCredentials,
} from "@/lib/instagram/credential-query";
import type { AccountOption } from "./account-select";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-accent";

export function InstagramCredentials({
  accounts,
  canManage,
}: {
  accounts: Array<AccountOption & { provider?: string }>;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const query = useInstagramCredentials();
  const metaAccounts = accounts.filter(
    (account) => account.provider !== "ZERNIO",
  );
  const [accountId, setAccountId] = useState("");
  const selectedAccountId = accountId || metaAccounts[0]?.id || "";
  const [name, setName] = useState("");
  const [appId, setAppId] = useState("");
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: async ({
      method,
      data,
    }: {
      method: "POST" | "PUT" | "DELETE";
      data: Record<string, string>;
    }) => {
      setNotice("");
      const response = await fetch("/api/instagram/credentials", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error ?? t("Could not update connection."));
      return method;
    },
    onSuccess: async (method) => {
      if (method === "POST") {
        setToken("");
        setName("");
        setAppId("");
      }
      setNotice(
        method === "DELETE"
          ? t("Credential removed.")
          : t(
              "Account verified. Sending permissions are checked when a reply is sent.",
            ),
      );
      await queryClient.invalidateQueries({ queryKey: credentialQueryKey });
    },
  });

  return (
    <section
      className="panel space-y-5 rounded p-4 sm:p-6"
      aria-labelledby="instagram-credentials-title"
    >
      <div className="flex items-start gap-3">
        <KeyRound
          className="mt-0.5 h-5 w-5 shrink-0 text-muted"
          aria-hidden="true"
        />
        <div>
          <h2
            id="instagram-credentials-title"
            className="text-base font-semibold"
          >
            {t("Instagram API credentials")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Save additional tokens for this account, then choose one for each campaign or video.",
            )}
          </p>
        </div>
      </div>
      {query.isPending && (
        <div
          role="status"
          aria-label={t("Loading credentials")}
          className="space-y-2 animate-pulse motion-reduce:animate-none"
        >
          <div className="h-16 rounded-lg bg-surface-hover" />
          <div className="h-16 rounded-lg bg-surface-hover" />
        </div>
      )}
      {(query.error || mutation.error) && (
        <p role="alert" className="text-sm text-error">
          {mutation.error?.message ?? query.error?.message}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="flex items-start gap-2 text-sm text-success"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          {notice}
        </p>
      )}
      {query.data?.map((credential) => (
        <div
          key={credential.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0 space-y-1">
            <p className="break-words text-sm font-medium">{credential.name}</p>
            <p className="text-xs text-muted">
              @
              {
                accounts.find(
                  (account) => account.id === credential.instagramAccountId,
                )?.username
              }{" "}
              · App {credential.appId}
            </p>
            <p className="text-xs text-muted">
              {t("Last verified")}:{" "}
              {new Date(credential.verifiedAt).toLocaleString()}
            </p>
            {credential.tokenExpiresAt && (
              <p className="text-xs text-muted">
                {t("Expires")}:{" "}
                {new Date(credential.tokenExpiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {canManage && (
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                disabled={mutation.isPending}
                className="text-accent disabled:opacity-50"
                onClick={() =>
                  mutation.mutate({
                    method: "PUT",
                    data: { id: credential.id },
                  })
                }
              >
                {t("Test connection")}
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                className="text-error disabled:opacity-50"
                onClick={() => {
                  if (
                    confirm(
                      t(
                        "Remove this credential? Campaigns using it must be switched first.",
                      ),
                    )
                  )
                    mutation.mutate({
                      method: "DELETE",
                      data: { id: credential.id },
                    });
                }}
              >
                {t("Remove credential")}
              </button>
            </div>
          )}
        </div>
      ))}
      {query.data?.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
          {t("Campaigns currently use the account's default connection.")}
        </p>
      )}
      {canManage && metaAccounts.length > 0 && (
        <form
          className="space-y-3 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({
              method: "POST",
              data: {
                instagramAccountId: selectedAccountId,
                name,
                appId,
                accessToken: token,
              },
            });
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>{t("Instagram account")}</span>
            <select
              className={fieldClass}
              value={selectedAccountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {metaAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  @{account.username}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span>{t("Credential name")}</span>
              <input
                required
                maxLength={80}
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="OpenReply Campaigns"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Meta App ID</span>
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{5,30}"
                className={fieldClass}
                value={appId}
                onChange={(event) => setAppId(event.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span>Instagram Access Token</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={20}
              maxLength={4096}
              className={fieldClass}
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <p className="text-xs leading-5 text-muted">
            {t(
              "Use an Instagram Login token for this account. Tokens are encrypted and never displayed again. A new token does not guarantee removal of Meta restrictions.",
            )}
          </p>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {mutation.isPending && (
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
              />
            )}
            {t("Verify and save credential")}
          </button>
        </form>
      )}
    </section>
  );
}
