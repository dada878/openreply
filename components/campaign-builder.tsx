"use client";

/** Shared campaign/template editor with a live preview. */

import Link from "next/link";
import SaveTemplate from "@/components/save-template";
import {
  campaignTemplateSchema,
  type SavedCampaignTemplate,
  type TemplateConfig,
} from "@/lib/templates/saved-schema";
import { useI18n } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  appendMarketingTrackingParams,
  MARKETING_TRACKING_PARAMS,
  type MarketingTrackingKey,
} from "@/lib/tracking/marketing-params";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import PostPicker from "@/components/post-picker";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import { readCache, writeCache } from "@/lib/client-cache";
import {
  IMPORT_QUEUE_KEY,
  IMPORT_ACCOUNT_KEY,
  type ImportRow,
} from "@/lib/import-queue";
import { Sparkles } from "lucide-react";
import { PUBLIC_REPLY_AI_MODELS } from "@/lib/ai/public-reply";
import { CampaignBuilderSkeleton } from "@/components/loading-skeleton";

type TriggerScope = "specific" | "any" | "next";
type MatchMode = "specific" | "any";

interface LoadedCampaign {
  id: string;
  name: string;
  postId: string | null;
  postUrl: string | null;
  trackingParamKeys: MarketingTrackingKey[];
  trackingEventId: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmTriggerEnabled: boolean;
  wholeWordMatch: boolean;
  dmMessage: string;
  commentDmEnabled: boolean;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followCheckFailedMessage: string | null;
  collectEmail: boolean;
  emailPromptMessage: string | null;
  emailInvalidMessage: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDestinationUrl: string | null;
  followUpButtonLabel: string | null;
  followUpDelayMinutes: number | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  aiPublicReplyEnabled: boolean;
  aiPublicReplyPrompt: string | null;
  aiPublicReplyModel: string | null;
  isActive: boolean;
  instagramAccountId: string;
  trackedLinks?: { destinationUrl: string; label?: string | null }[];
}

interface CampaignBuilderProps {
  mode: "new" | "edit" | "template";
  template?: SavedCampaignTemplate;
  campaignId?: string;
  allowImportQueue?: boolean;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Radio({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
        checked ? "border-accent bg-accent/5" : "border-border hover:border-border-hover"
      }`}
    >
      <span
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
          checked ? "border-accent" : "border-zinc-500"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="flex-1 text-foreground">{children}</span>
    </button>
  );
}

function Toggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-accent" : "bg-zinc-300"
      }`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
          on ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export default function CampaignBuilder({
  mode,
  campaignId,
  template,
  allowImportQueue = false,
}: CampaignBuilderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const initial = template?.config;

  const [loading, setLoading] = useState(mode === "edit");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(template?.name ?? "");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [triggerScope, setTriggerScope] = useState<TriggerScope>(initial?.triggerScope ?? "specific");
  const [postId, setPostId] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState("");

  // Post IDs already tied to another automation on this account, so the picker
  // can flag them and the user knows not to double-assign. Maps postId ->
  // the campaign name using it (for the tooltip).
  const [usedPosts, setUsedPosts] = useState<Record<string, string>>({});

  const [matchMode, setMatchMode] = useState<MatchMode>(initial?.matchAnyWord ? "any" : "specific");
  const [keywordText, setKeywordText] = useState(initial?.keywords.join(", ") ?? "");
  const [wholeWordMatch, setWholeWordMatch] = useState(initial?.wholeWordMatch ?? true);
  const [dmTriggerEnabled, setDmTriggerEnabled] = useState(initial?.dmTriggerEnabled ?? false);
  const [commentDmEnabled, setCommentDmEnabled] = useState(initial?.commentDmEnabled ?? true);

  const [publicReplyEnabled, setPublicReplyEnabled] = useState(initial?.publicReplyEnabled ?? false);
  const [publicReplyMessages, setPublicReplyMessages] = useState<string[]>(initial?.publicReplyMessages.length ? initial.publicReplyMessages : [""]);
  const [aiPublicReplyEnabled, setAiPublicReplyEnabled] = useState(initial?.aiPublicReplyEnabled ?? false);
  const [aiPublicReplyPrompt, setAiPublicReplyPrompt] = useState(initial?.aiPublicReplyPrompt ?? "");
  const [aiPublicReplyModel, setAiPublicReplyModel] = useState(initial?.aiPublicReplyModel ?? "gpt-4o-mini");
  const [aiTestCommenterName, setAiTestCommenterName] = useState("Dada");
  const [aiTestComment, setAiTestComment] = useState("想了解更多，謝謝！");
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [aiTestError, setAiTestError] = useState<string | null>(null);
  const [aiTesting, setAiTesting] = useState(false);

  const [openingDmEnabled, setOpeningDmEnabled] = useState(initial?.openingDmEnabled ?? false);
  const [openingDmMessage, setOpeningDmMessage] = useState(initial?.openingDmMessage ?? "");
  const [openingDmButtonLabel, setOpeningDmButtonLabel] = useState(initial?.openingDmButtonLabel ?? "");

  const [dmMessage, setDmMessage] = useState(initial?.dmMessage ?? "");
  const [linkOpen, setLinkOpen] = useState(Boolean(initial?.trackedDestinationUrl));
  const [trackedDestinationUrl, setTrackedDestinationUrl] = useState(initial?.trackedDestinationUrl ?? "");
  const [linkButtonLabel, setLinkButtonLabel] = useState(initial?.linkButtonLabel ?? "Open link");
  const [secondLinkOpen, setSecondLinkOpen] = useState(Boolean(initial?.secondaryDestinationUrl));
  const [secondaryDestinationUrl, setSecondaryDestinationUrl] = useState(initial?.secondaryDestinationUrl ?? "");
  const [secondaryButtonLabel, setSecondaryButtonLabel] = useState(initial?.secondaryButtonLabel ?? "Open link");
  const [trackingParamKeys, setTrackingParamKeys] = useState<MarketingTrackingKey[]>(initial?.trackingParamKeys ?? []);
  const [trackingEventId, setTrackingEventId] = useState(initial?.trackingEventId ?? "");
  const [requireFollow, setRequireFollow] = useState(initial?.requireFollow ?? false);
  const [followPromptMessage, setFollowPromptMessage] = useState(initial?.followPromptMessage ?? "");
  const [followPromptButtonLabel, setFollowPromptButtonLabel] =
    useState(initial?.followPromptButtonLabel ?? "i'm following");
  const [followCheckFailedMessage, setFollowCheckFailedMessage] = useState(
    initial?.followCheckFailedMessage ?? "看起來你還沒有追蹤帳號。追蹤後，再點一次按鈕。"
  );
  const [collectEmail, setCollectEmail] = useState(initial?.collectEmail ?? false);
  const [emailPromptMessage, setEmailPromptMessage] = useState(
    initial?.emailPromptMessage ?? "請直接回覆你的 Email，我就把內容傳給你。"
  );
  const [emailInvalidMessage, setEmailInvalidMessage] = useState(
    initial?.emailInvalidMessage ?? "請輸入有效的 Email。"
  );
  const [followUpEnabled, setFollowUpEnabled] = useState(initial?.followUpEnabled ?? false);
  const [followUpMessage, setFollowUpMessage] = useState(initial?.followUpMessage ?? "");
  const [followUpLinkOpen, setFollowUpLinkOpen] = useState(
    Boolean(initial?.followUpDestinationUrl)
  );
  const [followUpDestinationUrl, setFollowUpDestinationUrl] = useState(
    initial?.followUpDestinationUrl ?? ""
  );
  const [followUpButtonLabel, setFollowUpButtonLabel] = useState(
    initial?.followUpButtonLabel ?? "Open link"
  );
  const [followUpDelayMinutes, setFollowUpDelayMinutes] = useState(initial?.followUpDelayMinutes ?? 0);

  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");

  // CSV import queue. When present, each save advances to the next row instead
  // of returning to the campaigns list.
  const [importQueue, setImportQueue] = useState<ImportRow[] | null>(null);
  const [importTotal, setImportTotal] = useState(0);

  const keywords = useMemo(
    () =>
      keywordText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    [keywordText]
  );

  const trackingPreviewUrl = useMemo(() => {
    if (!trackedDestinationUrl.trim() || trackingParamKeys.length === 0) return null;
    return appendMarketingTrackingParams(trackedDestinationUrl.trim(), {
      keys: trackingParamKeys,
      accountName: "your-account",
      accountId: "account-id",
      campaignId: "campaign-id",
      eventId: trackingEventId.trim() || "event-id",
      videoId: "media-id",
      commenterId: "commenter-id",
    });
  }, [trackedDestinationUrl, trackingParamKeys, trackingEventId]);

  // Fetch the connected account's real avatar for the preview (cache-first so
  // it shows instantly on a return visit instead of a blank circle).
  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    const cacheKey = `ig-avatar:${selectedAccountId}`;
    const cached = readCache<string | null>(cacheKey, 30 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached.data !== null) setAvatarUrl(cached.data);

    const params = new URLSearchParams({ instagramAccountId: selectedAccountId });
    fetch(`/api/instagram/profile?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const url = d.success ? d.data.profilePictureUrl ?? null : null;
        setAvatarUrl(url);
        writeCache(cacheKey, url);
      })
      .catch(() => {
        if (!cancelled && cached.data === null) setAvatarUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  // Templates are account-independent; campaigns load the account selector.
  useEffect(() => {
    if (mode === "template") return;
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return;
        const next: AccountOption[] = payload.data.instagramAccounts ?? [];
        setAccounts(next);
        setSelectedAccountId(
          (prev) => prev || payload.data.selectedInstagramAccountId || next[0]?.id || ""
        );
      })
      .catch(() => setAccounts([]));
  }, [mode]);

  // Prefill when editing.
  useEffect(() => {
    if (mode !== "edit" || !campaignId) return;
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return setNotFound(true);
        const c = (payload.data as LoadedCampaign[]).find((x) => x.id === campaignId);
        if (!c) return setNotFound(true);
        setName(c.name);
        setSelectedAccountId(c.instagramAccountId);
        setTriggerScope(
          c.matchAnyPost ? "any" : c.pendingNextReel ? "next" : "specific"
        );
        setPostId(c.postId);
        setPostUrl(c.postUrl);
        setTrackingParamKeys(c.trackingParamKeys ?? []);
        setTrackingEventId(c.trackingEventId ?? "");
        setMatchMode(c.matchAnyWord ? "any" : "specific");
        setKeywordText(c.keywords.join(", "));
        setDmTriggerEnabled(c.dmTriggerEnabled ?? false);
        setCommentDmEnabled(c.commentDmEnabled ?? true);
        setWholeWordMatch(c.wholeWordMatch ?? true);
        setPublicReplyEnabled(c.publicReplyEnabled);
        setPublicReplyMessages(
          c.publicReplyMessages?.length
            ? c.publicReplyMessages
            : c.publicReplyMessage
              ? [c.publicReplyMessage]
              : [""]
        );
        setAiPublicReplyEnabled(c.aiPublicReplyEnabled ?? false);
        setAiPublicReplyPrompt(c.aiPublicReplyPrompt ?? "");
        setAiPublicReplyModel(c.aiPublicReplyModel ?? "gpt-4o-mini");
        setOpeningDmEnabled(c.openingDmEnabled);
        setOpeningDmMessage(c.openingDmMessage ?? "");
        setOpeningDmButtonLabel(c.openingDmButtonLabel ?? "");
        setDmMessage(c.dmMessage);
        setLinkButtonLabel(c.linkButtonLabel ?? "Open link");
        setIsActive(c.isActive);
        const link = c.trackedLinks?.[0]?.destinationUrl ?? "";
        setTrackedDestinationUrl(link);
        setLinkOpen(Boolean(link));
        const secondLink = c.trackedLinks?.[1];
        setSecondaryDestinationUrl(secondLink?.destinationUrl ?? "");
        setSecondaryButtonLabel(secondLink?.label ?? "Open link");
        setSecondLinkOpen(Boolean(secondLink?.destinationUrl));
        setRequireFollow(c.requireFollow ?? false);
        setFollowPromptMessage(c.followPromptMessage ?? "");
        setFollowPromptButtonLabel(
          c.followPromptButtonLabel ?? "i'm following"
        );
        setFollowCheckFailedMessage(
          c.followCheckFailedMessage ?? "看起來你還沒有追蹤帳號。追蹤後，再點一次按鈕。"
        );
        setCollectEmail(c.collectEmail ?? false);
        setEmailPromptMessage(
          c.emailPromptMessage ?? "請直接回覆你的 Email，我就把內容傳給你。"
        );
        setEmailInvalidMessage(c.emailInvalidMessage ?? "請輸入有效的 Email。");
        setFollowUpEnabled(c.followUpEnabled ?? false);
        setFollowUpMessage(c.followUpMessage ?? "");
        setFollowUpLinkOpen(Boolean(c.followUpDestinationUrl));
        setFollowUpDestinationUrl(c.followUpDestinationUrl ?? "");
        setFollowUpButtonLabel(c.followUpButtonLabel ?? "Open link");
        setFollowUpDelayMinutes(c.followUpDelayMinutes ?? 0);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [mode, campaignId]);

  // Track which posts on the selected account are already assigned to an
  // automation, so the picker can highlight them. The campaign being edited is
  // excluded — its own post should read as selected, not "taken".
  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled || !payload.success) return;
        const map: Record<string, string> = {};
        for (const a of payload.data as LoadedCampaign[]) {
          if (!a.postId) continue;
          if (a.instagramAccountId !== selectedAccountId) continue;
          if (mode === "edit" && a.id === campaignId) continue;
          map[a.postId] = a.name;
        }
        setUsedPosts(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, mode, campaignId]);

  // Prefill the editable fields from one queued import row. The reel is left
  // unset so the user picks it per row.
  function prefillFromRow(row: ImportRow) {
    setName(row.name ?? "");
    setTriggerScope("specific");
    setPostId(null);
    setPostUrl(null);
    setPostThumb(null);
    setPostCaption("");
    setMatchMode("specific");
    setKeywordText((row.keywords ?? []).join(", "));
    setDmMessage(row.dmMessage ?? "");
    setPublicReplyEnabled(Boolean(row.publicReply));
    setPublicReplyMessages(row.publicReply ? [row.publicReply] : [""]);
    const hasOpening = Boolean(row.openingDmMessage);
    setOpeningDmEnabled(hasOpening);
    setOpeningDmMessage(row.openingDmMessage ?? "");
    setOpeningDmButtonLabel(
      row.openingDmButtonLabel || (hasOpening ? "Send link" : "")
    );
    const link = row.trackedUrl ?? "";
    setTrackedDestinationUrl(link);
    setLinkOpen(Boolean(link));
    setError(null);
  }

  // Pick up a staged CSV import (new mode only) and prefill the first row.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "new" || template || !allowImportQueue) return;
    try {
      const raw = window.localStorage.getItem(IMPORT_QUEUE_KEY);
      const acct = window.localStorage.getItem(IMPORT_ACCOUNT_KEY);
      if (!raw) return;
      const queue = JSON.parse(raw) as ImportRow[];
      if (!Array.isArray(queue) || queue.length === 0) return;
      setImportQueue(queue);
      setImportTotal(queue.length);
      if (acct) setSelectedAccountId(acct);
      prefillFromRow(queue[0]);
    } catch {
      // ignore a malformed queue
    }
  }, [mode, template, allowImportQueue]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const username =
    accounts.find((a) => a.id === selectedAccountId)?.username ?? "yourbrand";

  function handlePostSelect(
    id: string,
    url?: string,
    thumb?: string,
    caption?: string
  ) {
    setPostId(id);
    setPostUrl(url ?? null);
    setPostThumb(thumb ?? null);
    setPostCaption(caption ?? "");
  }

  function ensureLinkToken() {
    setDmMessage((cur) => (cur.includes("{link}") ? cur : `${cur.trim()} {link}`.trim()));
  }

  function getTemplateConfig(): TemplateConfig {
    return {
      version: 1,
      triggerScope,
      keywords,
      matchAnyWord: matchMode === "any",
      wholeWordMatch,
      dmTriggerEnabled,
      commentDmEnabled,
      dmMessage,
      openingDmEnabled,
      openingDmMessage,
      openingDmButtonLabel,
      publicReplyEnabled,
      publicReplyMessages,
      aiPublicReplyEnabled,
      aiPublicReplyPrompt,
      aiPublicReplyModel,
      trackedDestinationUrl: trackedDestinationUrl.trim(),
      trackingParamKeys,
      trackingEventId: trackingEventId.trim(),
      linkButtonLabel,
      secondaryDestinationUrl: secondaryDestinationUrl.trim(),
      secondaryButtonLabel,
      requireFollow,
      followPromptMessage,
      followPromptButtonLabel,
      followCheckFailedMessage,
      collectEmail,
      emailPromptMessage,
      emailInvalidMessage,
      followUpEnabled,
      followUpMessage,
      followUpDestinationUrl,
      followUpButtonLabel,
      followUpDelayMinutes,
    };
  }

  async function saveTemplate() {
    const parsed = campaignTemplateSchema.safeParse({ name, config: getTemplateConfig() });
    if (!parsed.success) {
      setError(t("Could not save the template. Check the name, keywords and message settings, then try again."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(template
        ? `/api/campaign-templates?id=${encodeURIComponent(template.id)}`
        : "/api/campaign-templates", {
        method: template ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error("Template save failed");
      router.push("/campaign-templates");
      router.refresh();
    } catch {
      setError(t("Could not save the template. Check the name, keywords and message settings, then try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(activeValue: boolean) {
    setError(null);

    if (!selectedAccountId) return setError(t("Connect an Instagram account first."));
    if (triggerScope === "specific" && !postId)
      return setError(t("Pick a post or reel to trigger the campaign."));
    if (matchMode === "specific" && keywords.length === 0)
      return setError(t("Add at least one keyword, or switch to any word."));
    if ((commentDmEnabled || dmTriggerEnabled) && !dmMessage.trim()) {
      return setError(t("Add the DM with the link."));
    }
    if (aiPublicReplyEnabled && !aiPublicReplyPrompt.trim()) {
      return setError(t("Add an AI instruction for the public reply."));
    }
    if (openingDmEnabled && (!openingDmMessage.trim() || !openingDmButtonLabel.trim()))
      return setError(t("Your opening DM needs a message and a button label."));

    setSaving(true);

    const payload = {
      name: name.trim() || `Campaign for @${username}`,
      instagramAccountId: selectedAccountId,
      postId: triggerScope === "specific" ? postId : null,
      postUrl: triggerScope === "specific" ? postUrl : null,
      matchAnyPost: triggerScope === "any",
      pendingNextReel: triggerScope === "next",
      matchAnyWord: matchMode === "any",
      keywords: matchMode === "any" ? [] : keywords,
      dmTriggerEnabled,
      wholeWordMatch,
      dmMessage,
      commentDmEnabled,
      openingDmEnabled,
      openingDmMessage: openingDmEnabled ? openingDmMessage : null,
      openingDmButtonLabel: openingDmEnabled ? openingDmButtonLabel : null,
      publicReplyEnabled,
      publicReplyMessages: publicReplyEnabled
        ? publicReplyMessages.map((m) => m.trim()).filter(Boolean)
        : [],
      aiPublicReplyEnabled: publicReplyEnabled && aiPublicReplyEnabled,
      aiPublicReplyPrompt:
        publicReplyEnabled && aiPublicReplyEnabled ? aiPublicReplyPrompt.trim() : "",
      aiPublicReplyModel:
        publicReplyEnabled && aiPublicReplyEnabled ? aiPublicReplyModel : "",
      trackedDestinationUrl: trackedDestinationUrl.trim() || "",
      trackingParamKeys,
      trackingEventId: trackingEventId.trim() || "",
      linkButtonLabel: linkButtonLabel.trim() || "Open link",
      secondaryDestinationUrl: secondaryDestinationUrl.trim() || "",
      secondaryButtonLabel: secondaryButtonLabel.trim() || "Open link",
      requireFollow,
      followPromptMessage: requireFollow ? followPromptMessage.trim() : "",
      followPromptButtonLabel: requireFollow
        ? followPromptButtonLabel.trim() || "i'm following"
        : "",
      followCheckFailedMessage: requireFollow ? followCheckFailedMessage.trim() : "",
      collectEmail,
      emailPromptMessage: collectEmail ? emailPromptMessage.trim() : "",
      emailInvalidMessage: collectEmail ? emailInvalidMessage.trim() : "",
      followUpEnabled,
      followUpMessage: followUpEnabled ? followUpMessage.trim() : "",
      followUpDestinationUrl:
        followUpEnabled && followUpLinkOpen
          ? followUpDestinationUrl.trim()
          : "",
      followUpButtonLabel:
        followUpEnabled && followUpLinkOpen
          ? followUpButtonLabel.trim() || "Open link"
          : "",
      followUpDelayMinutes: followUpEnabled ? followUpDelayMinutes : 0,
      isActive: activeValue,
    };

    try {
      const res =
        mode === "new"
          ? await fetch("/api/automations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/automations?id=${campaignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json();
      if (data.success) {
        // The campaign list is backed by React Query and can stay mounted in
        // the shared client while this editor is open. Mark every account
        // filter stale before navigating so returning to the list always
        // reads the saved campaign from the server instead of a pre-edit
        // cache entry.
        await queryClient.invalidateQueries({ queryKey: ["automations"] });
        // The post we just assigned is now in use. Reflect it immediately so
        // the picker flags it on the next imported row — the fetch that builds
        // this map doesn't re-run while the builder stays mounted through the
        // import queue.
        if (triggerScope === "specific" && postId) {
          const assignedPostId = postId;
          setUsedPosts((prev) => ({ ...prev, [assignedPostId]: payload.name }));
        }
        // Importing: advance to the next queued row instead of leaving.
        if (importQueue && importQueue.length > 1) {
          const remaining = importQueue.slice(1);
          try {
            window.localStorage.setItem(
              IMPORT_QUEUE_KEY,
              JSON.stringify(remaining)
            );
          } catch {
            // ignore
          }
          setImportQueue(remaining);
          prefillFromRow(remaining[0]);
          setSaving(false);
          if (typeof window !== "undefined") window.scrollTo({ top: 0 });
          return;
        }
        if (importQueue) {
          try {
            window.localStorage.removeItem(IMPORT_QUEUE_KEY);
            window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
          } catch {
            // ignore
          }
        }
        // refresh() busts the router cache so the list reflects the save
        // instead of landing on a stale (empty) campaigns page.
        router.push("/campaigns");
        router.refresh();
      } else {
        // Surface the specific field that failed validation instead of a
        // generic "Invalid input".
        const fieldErrors = data.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        const firstField = fieldErrors && Object.keys(fieldErrors)[0];
        setError(
          firstField
            ? `${firstField}: ${fieldErrors[firstField][0]}`
            : data.error ?? t("Failed to save campaign")
        );
        if (typeof window !== "undefined")
          window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError(t("Failed to save campaign"));
    } finally {
      setSaving(false);
    }
  }

  // Skip the current imported row without saving a campaign for it, advancing
  // to the next one (or finishing the import if it was the last).
  function skipRow() {
    if (!importQueue) return;
    setError(null);
    if (importQueue.length > 1) {
      const remaining = importQueue.slice(1);
      try {
        window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(remaining));
      } catch {
        // ignore
      }
      setImportQueue(remaining);
      prefillFromRow(remaining[0]);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      return;
    }
    // Last row skipped — finish the import.
    try {
      window.localStorage.removeItem(IMPORT_QUEUE_KEY);
      window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
    } catch {
      // ignore
    }
    router.push("/campaigns");
    router.refresh();
  }

  async function testAiPublicReply() {
    setAiTesting(true);
    setAiTestResult(null);
    setAiTestError(null);
    try {
      const response = await fetch("/api/ai/public-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPublicReplyPrompt.trim(),
          model: aiPublicReplyModel,
          username: aiTestCommenterName.trim() || "commenter",
          displayName: aiTestCommenterName.trim() || "留言者",
          commentText: aiTestComment.trim(),
          accountUsername: username,
          existingReply: publicReplyMessages.find((message) => message.trim())?.trim() || "謝謝你的留言！",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? t("AI test failed"));
      }
      setAiTestResult(payload.data.reply);
    } catch (error) {
      setAiTestError(error instanceof Error ? error.message : t("AI test failed"));
    } finally {
      setAiTesting(false);
    }
  }

  if (loading) {
    return <CampaignBuilderSkeleton />;
  }

  if (notFound) {
    return (
      <div className="panel rounded p-8 text-center">
        <p className="text-sm text-muted">{t("Campaign not found.")}</p>
        <button
          onClick={() => router.push("/campaigns")}
          className="mt-4 rounded border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
        >
          {t("Back to campaigns")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mode === "template" ? (
        <p className="rounded border border-border p-4 text-sm text-muted">{t("Edit the reusable flow here. Choose the account and post when you use it in a campaign.")} {t("Changes to this template do not affect existing campaigns.")}</p>
      ) : template ? (
        <p className="rounded border border-accent/30 bg-accent/5 p-4 text-sm">{t("Initial settings from template: {name}", { name: template.name })} {t("Review the account, post, keywords and links before going live.")}</p>
      ) : null}
      {importQueue && (
        <div className="rounded border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">
            {t("Importing {current} of {total}.", { current: importTotal - importQueue.length + 1, total: importTotal })}
          </span>{" "}
          <span className="text-muted">
            {t("Fields are prefilled from your CSV. Pick the reel, edit anything, and save to load the next one — or Skip if you don’t want this one.")}
          </span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          {mode === "edit" ? (
            <>
              <span className="truncate text-sm font-semibold text-foreground">
                {name || t("Untitled campaign")}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  isActive ? "bg-success/15 text-success" : "bg-zinc-500/15 text-muted"
                }`}
              >
                {isActive ? t("LIVE") : t("PAUSED")}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted">{mode === "template" ? t(template ? "Edit template" : "New template") : t("New campaign")}</span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {mode === "template" && <Link href="/campaign-templates" className="rounded-lg border border-border px-4 py-2 text-sm">{t("Cancel")}</Link>}
          {mode === "new" && template && <button type="button" disabled={saving} onClick={() => handleSubmit(false)} className="rounded-lg border border-border px-4 py-2 text-sm">{t("Save paused")}</button>}
          {importQueue && (
            <button
              type="button"
              onClick={skipRow}
              disabled={saving}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
            >
              {importQueue.length > 1 ? t("Skip") : t("Skip & finish")}
            </button>
          )}
          {mode === "edit" &&
            (isActive ? (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
              >
                {t("Stop")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
              >
                {t("Go Live")}
              </button>
            ))}
          <button
            type="button"
            onClick={() => mode === "template" ? saveTemplate() : handleSubmit(mode === "new" ? true : isActive)}
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? t("Saving…") : mode === "template" ? t("Save template") : mode === "new" ? t("Go Live") : t("Save changes")}
          </button>
        </div>
      </div>

      {mode !== "template" && <SaveTemplate defaultName={name} getConfig={getTemplateConfig} />}

      {/* min-w-0 on the cells: a grid item defaults to min-width:auto, so a
          long string widens the whole page instead of wrapping. */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-8">
      {/* Left: controls */}
      <div className="space-y-8 min-w-0">
        {error && (
          <div role="alert" className="rounded border border-error/20 bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label htmlFor="builder-name" className="text-sm font-semibold text-foreground">
            {mode === "template" ? t("Template name") : t("Campaign name")}{" "}
            {mode !== "template" && <span className="font-normal text-muted">{t("(optional)")}</span>}
          </label>
          <input
            id="builder-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("e.g. YC referral")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
            maxLength={100}
          />
          {accounts.length > 1 && (
            <div className="pt-2">
              <AccountSelect
                accounts={accounts}
                value={selectedAccountId}
                onChange={(id) => {
                  setSelectedAccountId(id);
                  setPostId(null);
                  setPostUrl(null);
                  setPostThumb(null);
                }}
                includeAll={false}
                label={t("Instagram account")}
              />
            </div>
          )}
        </div>

        <Section title={t("When someone comments on")}>
          <Radio
            checked={triggerScope === "specific"}
            onSelect={() => setTriggerScope("specific")}
          >
            {t("a specific post or reel")}
          </Radio>
          {triggerScope === "specific" && mode !== "template" && (
            <div className="rounded-lg border border-border p-2">
              <PostPicker
                selectedPostId={postId}
                instagramAccountId={selectedAccountId}
                usedPostIds={usedPosts}
                onSelect={handlePostSelect}
              />
            </div>
          )}
          <Radio
            checked={triggerScope === "any"}
            onSelect={() => setTriggerScope("any")}
          >
            {t("any post or reel")}
          </Radio>
          <Radio
            checked={triggerScope === "next"}
            onSelect={() => setTriggerScope("next")}
          >
            {t("next post or reel")}
          </Radio>
        </Section>

        <Section title={t("And this comment has")}>
          <Radio
            checked={matchMode === "specific"}
            onSelect={() => setMatchMode("specific")}
          >
            {t("a specific word or words")}
          </Radio>
          {matchMode === "specific" && (
            <div className="space-y-1">
              <input
                value={keywordText}
                onChange={(e) => setKeywordText(e.target.value)}
                placeholder={t("Enter a word or multiple")}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
              />
              <p className="text-xs text-muted">{t("Use commas to separate words")}</p>
            </div>
          )}
          <Radio
            checked={matchMode === "any"}
            onSelect={() => setMatchMode("any")}
          >
            {t("any word")}
          </Radio>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm text-foreground">
              {t("also reply when someone DMs")}{" "}
              {matchMode === "any" ? t("anything") : t("these words")}
            </span>
            <Toggle
              label={`${t("also reply when someone DMs")} ${matchMode === "any" ? t("anything") : t("these words")}`}
              on={dmTriggerEnabled}
              onToggle={() => setDmTriggerEnabled(!dmTriggerEnabled)}
            />
          </div>
          {dmTriggerEnabled && (
            <p className="text-xs text-muted">
              {matchMode === "any"
                ? t("Every DM to this account gets the reply below — use with care.")
                : t("A DM containing any of these words gets the same reply, no comment needed.")}
            </p>
          )}
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <span className="text-sm text-foreground">
              {t("reply to their comments under the post")}
            </span>
            <Toggle
              label={t("reply to their comments under the post")}
              on={publicReplyEnabled}
              onToggle={() => setPublicReplyEnabled(!publicReplyEnabled)}
            />
          </div>
          {publicReplyEnabled && (
            <div className="rounded-lg border border-border bg-surface/60 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm text-foreground">留言後傳送私訊</span>
                  {!commentDmEnabled && <p className="mt-1 text-xs text-muted">只回覆留言；AI 公開回覆仍會正常運作。</p>}
                </div>
                <Toggle
                  label="留言後傳送私訊"
                  on={commentDmEnabled}
                  onToggle={() => setCommentDmEnabled(!commentDmEnabled)}
                />
              </div>
            </div>
          )}
          {publicReplyEnabled && (
            <div className="space-y-2">
              {publicReplyMessages.map((msg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={msg}
                    onChange={(e) =>
                      setPublicReplyMessages((prev) =>
                        prev.map((m, idx) => (idx === i ? e.target.value : m))
                      )
                    }
                    placeholder={t("Sent you a DM! 📩")}
                    maxLength={1000}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                  />
                  {publicReplyMessages.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPublicReplyMessages((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      className="shrink-0 px-2 text-muted hover:text-error"
                      aria-label={t("Remove reply")}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {publicReplyMessages.length < 10 && (
                <button
                  type="button"
                  onClick={() =>
                    setPublicReplyMessages((prev) => [...prev, ""])
                  }
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {t("+ Add another reply")}
                </button>
              )}
              <p className="text-xs text-muted">
                {t("One is picked at random each time, so replies don't look identical.")}
              </p>
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
                    <span>{t("Generate the public reply with AI")}</span>
                  </div>
                  <Toggle
                    label={t("Generate the public reply with AI")}
                    on={aiPublicReplyEnabled}
                    onToggle={() => setAiPublicReplyEnabled(!aiPublicReplyEnabled)}
                  />
                </div>
                {aiPublicReplyEnabled && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={aiPublicReplyPrompt}
                      onChange={(e) => setAiPublicReplyPrompt(e.target.value)}
                      placeholder={t("Write how the AI should reply to comments…")}
                      rows={4}
                      maxLength={2000}
                      className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                    />
                    <label className="flex items-center gap-3 text-sm text-foreground">
                      <span className="shrink-0 text-muted">AI 模型</span>
                      <select
                        value={aiPublicReplyModel}
                        onChange={(event) => setAiPublicReplyModel(event.target.value)}
                        className="min-w-44 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent/40 focus:outline-none"
                      >
                        {PUBLIC_REPLY_AI_MODELS.map((model) => (
                          <option key={model.value} value={model.value}>{model.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-lg border border-border bg-surface/60 p-3">
                      <p className="text-xs font-medium text-foreground">測試 AI 公開回覆</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          value={aiTestCommenterName}
                          onChange={(event) => setAiTestCommenterName(event.target.value)}
                          placeholder="留言者名稱"
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                        />
                        <input
                          value={aiTestComment}
                          onChange={(event) => setAiTestComment(event.target.value)}
                          placeholder="輸入一則測試留言"
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void testAiPublicReply()}
                          disabled={aiTesting || !aiPublicReplyPrompt.trim()}
                          className="rounded-lg border border-accent/40 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {aiTesting ? "生成中…" : "測試生成回覆"}
                        </button>
                        {aiTestResult && <p className="text-sm text-foreground">{aiTestResult}</p>}
                        {aiTestError && <p className="text-sm text-error">{aiTestError}</p>}
                      </div>
                    </div>
                    <p className="text-xs leading-5 text-muted">
                      {t(
                        "Available variables: {username}, {display_name}, {comment}, {account_name}. Your saved reply is used if AI is unavailable.",
                        {
                          username: "{username}",
                          display_name: "{display_name}",
                          comment: "{comment}",
                          account_name: "{account_name}",
                        },
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>

        {commentDmEnabled && <Section title={t("They will get")}>
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{t("an opening DM")}</span>
              <Toggle
                label={t("an opening DM")}
                on={openingDmEnabled}
                onToggle={() => setOpeningDmEnabled(!openingDmEnabled)}
              />
            </div>
            {openingDmEnabled && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={openingDmMessage}
                  onChange={(e) => setOpeningDmMessage(e.target.value)}
                  placeholder={t("Hey there! I'm so happy you're here 😊")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
                  maxLength={1000}
                />
                <input
                  value={openingDmButtonLabel}
                  onChange={(e) => setOpeningDmButtonLabel(e.target.value)}
                  placeholder={t("Send me the link")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                  maxLength={64}
                />
              </div>
            )}
          </div>
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {t("a follow requirement first")}
              </span>
              <Toggle
                label={t("a follow requirement first")}
                on={requireFollow}
                onToggle={() => setRequireFollow(!requireFollow)}
              />
            </div>
            {requireFollow && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={followPromptMessage}
                  onChange={(e) => setFollowPromptMessage(e.target.value)}
                  placeholder={t("quick favor before i send your link. i don't make any money from this, it's free. if you want to support me, just don't unfollow after, and star the repo on github if it helps you. tap the button once you're following and i'll send it over")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
                  maxLength={1000}
                />
                <input
                  value={followPromptButtonLabel}
                  onChange={(e) => setFollowPromptButtonLabel(e.target.value)}
                  placeholder={t("i'm following")}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                  maxLength={20}
                />
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted">
                    {t("Not-following reply")}
                  </span>
                  <textarea
                    value={followCheckFailedMessage}
                    onChange={(e) => setFollowCheckFailedMessage(e.target.value)}
                    placeholder={t("It looks like you haven't followed yet. Follow the account, then tap the button again.")}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
                    maxLength={1000}
                  />
                </label>
                <p className="text-xs text-muted">
                  {t("We send the link only after they tap the button and Instagram confirms the follow. If it can't be verified, we send it anyway.")}
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {t("collect an email before sending the content")}
              </span>
              <Toggle
                label={t("collect an email before sending the content")}
                on={collectEmail}
                onToggle={() => setCollectEmail(!collectEmail)}
              />
            </div>
            {collectEmail && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={emailPromptMessage}
                  onChange={(e) => setEmailPromptMessage(e.target.value)}
                  placeholder={t("Reply with your email and I’ll send the content over.")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
                  maxLength={1000}
                />
                <label className="block space-y-1.5">
                  <span className="text-xs text-muted">
                    {t("Invalid email reply")}
                  </span>
                  <textarea
                    value={emailInvalidMessage}
                    onChange={(e) => setEmailInvalidMessage(e.target.value)}
                    placeholder={t("Please enter a valid email address.")}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
                    maxLength={1000}
                  />
                </label>
                <p className="text-xs text-muted">
                  {t("They must reply with a valid email before the content is sent.")}
                </p>
              </div>
            )}
          </div>
        </Section>}

        {(commentDmEnabled || dmTriggerEnabled) && <Section title={t("And then, they will get")}>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <span className="text-sm text-foreground">{t("a DM with a link")}</span>
            <textarea
              value={dmMessage}
              onChange={(e) => setDmMessage(e.target.value)}
              placeholder={t("Write a message")}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
              maxLength={1000}
            />
            {linkOpen ? (
              <div className="space-y-2">
                <input
                  value={trackedDestinationUrl}
                  onChange={(e) => setTrackedDestinationUrl(e.target.value)}
                  onBlur={ensureLinkToken}
                  placeholder="https://yourlink.com/offer"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                />
                <input
                  value={linkButtonLabel}
                  onChange={(e) => setLinkButtonLabel(e.target.value)}
                  placeholder={t("Button label (e.g. Open link)")}
                  maxLength={20}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                />
                {secondLinkOpen ? (
                  <div className="space-y-2 border-t border-border pt-2">
                    <input
                      value={secondaryDestinationUrl}
                      onChange={(e) => setSecondaryDestinationUrl(e.target.value)}
                      placeholder="https://yourlink.com/second"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                    />
                    <input
                      value={secondaryButtonLabel}
                      onChange={(e) => setSecondaryButtonLabel(e.target.value)}
                      placeholder={t("Second button label")}
                      maxLength={20}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSecondLinkOpen(true)}
                    className="w-full rounded-lg border border-border py-2 text-sm text-muted hover:text-foreground"
                  >
                    {t("+ Add A Second Link")}
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="w-full rounded-lg border border-border py-2 text-sm text-muted hover:text-foreground"
              >
                {t("+ Add A Link")}
              </button>
            )}
            <p className="text-xs text-muted">
              {"{link}"} {t("inserts the tracked link;")} {"{username}"} {t("personalizes.")}
            </p>
          </div>
          {linkOpen && (
            <div className="rounded-lg border border-border bg-surface/60 p-3">
              <p className="text-sm font-medium text-foreground">行銷追蹤參數</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                勾選後，使用者點擊導流連結時，這些值會以 <code>or_</code> 參數附加到你的網址。
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Instagram 帳號名稱與 ID 會自動帶入上方選取的 Meta／Instagram 連線；活動與貼文資料也會由 OpenReply 自動代入。
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {MARKETING_TRACKING_PARAMS.map((item) => {
                  const checked = trackingParamKeys.includes(item.key);
                  return (
                    <label key={item.key} className="flex cursor-pointer items-start gap-2 rounded border border-border px-2.5 py-2 text-sm text-foreground hover:bg-surface-hover">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setTrackingParamKeys((current) => checked ? current.filter((key) => key !== item.key) : [...current, item.key])}
                        className="mt-0.5 accent-[var(--color-accent)]"
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
              {trackingParamKeys.includes("event_id") && (
                <input
                  value={trackingEventId}
                  onChange={(event) => setTrackingEventId(event.target.value)}
                  placeholder="事件 ID（例如 launch-2026-09）"
                  maxLength={120}
                  className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent/40 focus:outline-none"
                />
              )}
              <p className="mt-2 text-xs text-muted">
                留言者 ID 可協助你辨識個別使用者，請只在你的追蹤與隱私規範允許時啟用。
              </p>
              {trackingPreviewUrl && (
                <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
                  <span className="font-medium">預覽連結（示意值）</span>
                  <a
                    href={trackingPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all underline decoration-dotted underline-offset-2 hover:text-foreground"
                  >
                    {trackingPreviewUrl}
                  </a>
                </div>
              )}
            </div>
          )}
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {t("a follow-up thank-you message")}
              </span>
              <Toggle
                label={t("a follow-up thank-you message")}
                on={followUpEnabled}
                onToggle={() => setFollowUpEnabled(!followUpEnabled)}
              />
            </div>
            {followUpEnabled && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={followUpMessage}
                  onChange={(e) => setFollowUpMessage(e.target.value)}
                  placeholder={t("Btw just wanted to say thanks for following me, I appreciate the support 🙌")}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none resize-none"
                  maxLength={1000}
                />
                {followUpLinkOpen ? (
                  <div className="space-y-2">
                    <input
                      value={followUpDestinationUrl}
                      onChange={(e) => setFollowUpDestinationUrl(e.target.value)}
                      placeholder="https://yourlink.com/offer"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                    />
                    <input
                      value={followUpButtonLabel}
                      onChange={(e) => setFollowUpButtonLabel(e.target.value)}
                      placeholder={t("Button label (e.g. Open link)")}
                      maxLength={20}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFollowUpLinkOpen(true)}
                    className="w-full rounded-lg border border-border py-2 text-sm text-muted hover:text-foreground"
                  >
                    {t("+ Add A Link")}
                  </button>
                )}
                <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  <span className="text-xs text-muted">{t("Send it")}</span>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={followUpDelayMinutes}
                    onChange={(e) =>
                      setFollowUpDelayMinutes(
                        Math.max(0, Math.min(1440, Math.floor(Number(e.target.value) || 0)))
                      )
                    }
                    className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground focus:border-accent/40 focus:outline-none"
                  />
                  <span className="text-xs text-muted">
                    {t("minutes after the link")}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {followUpDelayMinutes > 0
                    ? t("Sent {minutes} min after they tap through.", { minutes: followUpDelayMinutes })
                    : t("Sent right after they tap through.")}
                  {" {username}"} {t("personalizes it. Max 24 hours, to stay inside Instagram's messaging window.")}
                </p>
              </div>
            )}
          </div>
        </Section>}
      </div>

      {/* Right: preview */}
      <div>
        <p className="mb-4 text-sm text-muted">{t("Preview")}</p>
        <div className="flex min-w-0 justify-center lg:sticky lg:top-6 lg:block">
          <CampaignPreview
            tab={previewTab}
            onTabChange={setPreviewTab}
            username={username}
            avatarUrl={avatarUrl}
            postThumb={postThumb}
            caption={postCaption}
            sampleComment={keywords[0] ?? ""}
            dmTriggerEnabled={dmTriggerEnabled}
            publicReplyEnabled={publicReplyEnabled}
            publicReplyMessage={publicReplyMessages.find((m) => m.trim()) ?? ""}
            openingDmEnabled={openingDmEnabled}
            openingDmMessage={openingDmMessage}
            openingDmButtonLabel={openingDmButtonLabel}
            revealMessage={dmMessage}
            hasLink={Boolean(trackedDestinationUrl.trim())}
            linkButtonLabel={linkButtonLabel || "Open link"}
            linkUrl={trackedDestinationUrl.trim() || undefined}
            hasSecondLink={
              secondLinkOpen && Boolean(secondaryDestinationUrl.trim())
            }
            secondLinkButtonLabel={secondaryButtonLabel || "Open link"}
            requireFollow={requireFollow}
            followPromptMessage={followPromptMessage}
            followPromptButtonLabel={followPromptButtonLabel || "i'm following"}
            collectEmail={collectEmail}
            emailPromptMessage={emailPromptMessage}
            followUpEnabled={followUpEnabled}
            followUpMessage={followUpMessage}
            followUpDestinationUrl={followUpLinkOpen ? followUpDestinationUrl : undefined}
            followUpButtonLabel={followUpButtonLabel || "Open link"}
            followUpDelayMinutes={followUpDelayMinutes}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
