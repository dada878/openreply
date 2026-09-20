"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

interface TemplateOptions {
  data: { id: string; name: string }[];
  hasMore: boolean;
}

export default function NewCampaignMenu({
  centered = false,
}: {
  centered?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TemplateOptions | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/campaign-templates", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load templates");
        const result: TemplateOptions = await response.json();
        if (!controller.signal.aborted) setOptions(result);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, attempt]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const itemClass =
    "block rounded px-3 py-2 text-sm text-foreground hover:bg-surface focus-visible:bg-surface focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div
      ref={container}
      className={
        centered ? "relative inline-block" : "relative flex-1 sm:flex-none"
      }
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        onClick={() => {
          if (!open) {
            setOptions(null);
            setFailed(false);
          }
          setOpen(!open);
        }}
      >
        {t("New Campaign")}
        <svg
          aria-hidden="true"
          className="shrink-0"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
        </svg>
      </button>
      {open && (
        <div
          id={listId}
          className={`absolute top-full z-30 mt-2 max-h-[60vh] w-72 overflow-y-auto max-w-[calc(100vw-3rem)] rounded-lg border border-border bg-background p-1 text-left shadow-lg ${centered ? "left-1/2 -translate-x-1/2" : "right-0"}`}
        >
          <ul aria-label={t("New Campaign")}>
            <li>
              <Link
                className={itemClass}
                href="/campaigns/new"
                onClick={() => setOpen(false)}
              >
                {t("Blank campaign")}
              </Link>
            </li>
            {options?.data.map((template) => (
              <li key={template.id}>
                <Link
                  className={`${itemClass} break-words`}
                  href={`/campaigns/new?savedTemplate=${encodeURIComponent(template.id)}`}
                  onClick={() => setOpen(false)}
                >
                  {template.name}
                </Link>
              </li>
            ))}
            {options?.hasMore && (
              <li className="mt-1 border-t border-border pt-1">
                <Link
                  className={itemClass}
                  href="/campaign-templates"
                  onClick={() => setOpen(false)}
                >
                  {t("View all")}
                </Link>
              </li>
            )}
          </ul>
          {!options && !failed && (
            <p role="status" className="px-3 py-2 text-sm text-muted">
              {t("Loading…")}
            </p>
          )}
          {failed && (
            <div className="px-3 py-2 text-sm">
              <p role="alert" className="text-muted">
                {t("Could not load templates.")}
              </p>
              <button
                type="button"
                className="mt-1 text-accent underline"
                onClick={() => {
                  setFailed(false);
                  setAttempt((value) => value + 1);
                }}
              >
                {t("Try again")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
