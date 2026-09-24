"use client";

/**
 * Sidebar Navigation
 *
 * Grouped navigation with icons, active state and workspace section.
 */

import { useI18n } from "@/lib/i18n/provider";
import Link from "next/link";
import Image from "next/image";
import { zernioLink } from "@/lib/zernio-links";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChartNoAxesCombined,
  ContactRound,
  FileStack,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", group: "Workspace", icon: LayoutDashboard },
  { label: "Overview", href: "/overview", group: "Workspace", icon: ChartNoAxesCombined },
  { label: "Inbox", href: "/inbox", group: "Workspace", icon: Inbox },
  { label: "Campaigns", href: "/campaigns", group: "Automations", icon: Megaphone },
  { label: "My templates", href: "/campaign-templates", group: "Automations", icon: FileStack },
  { label: "DM Logs", href: "/logs", group: "Automations", icon: ListChecks },
  { label: "Contacts", href: "/contacts", group: "Audience", icon: ContactRound },
  { label: "Settings", href: "/settings", group: "System", icon: Settings },
  { label: "Diagnostics", href: "/diagnostics", group: "System", icon: Activity },
] as const;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  workspaceName,
}: SidebarProps) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 bg-surface border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Same reason as the top bar: the drawer is full height, so the
            wordmark would otherwise land under the status bar. */}
        <div
          className="px-6 py-5 border-b border-border"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
        >
          <Link href="/dashboard" className="inline-flex items-center gap-2.5 text-base font-semibold" aria-label="OpenReply 首頁">
            <Image
              src="/icon-192.png"
              alt=""
              width={30}
              height={30}
              priority
              className="h-7 w-7 rounded-lg"
            />
            <span>OpenReply</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {Array.from(new Set(navItems.map((item) => item.group))).map((group) => (
            <div key={group} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                {t(group)}
              </p>
              {navItems.filter((item) => item.group === group).map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive ? "page" : undefined}
                    className={`
                      flex items-center gap-3 rounded px-3 py-2.5 text-sm
                      ${
                        isActive
                          ? "bg-surface-hover text-foreground font-medium"
                          : "text-muted hover:text-foreground hover:bg-surface-hover"
                      }
                    `}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    {t(item.label)}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <p className="text-sm text-foreground truncate">{workspaceName}</p>
          <p className="text-xs text-muted">{t("Self-hosted")}</p>
          <a
            href={zernioLink({ placement: "sidebar" })}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="mt-4 flex items-center gap-3 text-xs text-muted hover:text-foreground"
          >
            <span>{t("Supported by")}</span>
            <Image
              src="/brand/zernio-primary.svg"
              alt="Zernio"
              width={64}
              height={20}
              className="m-2"
            />
          </a>
        </div>
      </aside>
    </>
  );
}
