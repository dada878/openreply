import type { CSSProperties, ReactNode } from "react";

/**
 * Content-shaped loading states for the dashboard.
 *
 * The skeletons intentionally follow the real page geometry so navigation
 * does not jump when the API response arrives. Keep this file presentational:
 * it should never own fetching or application state.
 */
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`skeleton-shimmer block ${className}`} style={style} />;
}

export function LoadingRegion({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      {children}
    </div>
  );
}

function StatSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className={`panel rounded p-4 sm:p-5 ${tall ? "min-h-32" : "min-h-24"}`}>
      <Skeleton className="h-3.5 w-20 rounded" />
      <Skeleton className="mt-4 h-8 w-16 rounded-md" />
      {tall && <Skeleton className="mt-3 h-2.5 w-28 rounded" />}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <LoadingRegion className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-8 w-56 rounded-lg sm:h-9" />
          <Skeleton className="h-3.5 w-72 rounded" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <StatSkeleton key={i} tall />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-6">
        <div className="panel rounded p-4 sm:p-6 lg:col-span-3">
          <Skeleton className="h-4 w-32 rounded" />
          <div className="mt-7 flex h-40 items-end gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="min-w-0 flex-1 rounded-t" style={{ height: `${35 + ((i * 17) % 55)}%` }} />
            ))}
          </div>
        </div>
        <div className="panel rounded p-4 sm:p-6 lg:col-span-1">
          <Skeleton className="h-4 w-28 rounded" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-3.5 rounded" />)}
          </div>
        </div>
        <div className="panel rounded p-4 sm:p-6 lg:col-span-2">
          <Skeleton className="h-4 w-36 rounded" />
          <div className="mt-6 space-y-5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function OverviewSkeleton() {
  return (
    <LoadingRegion className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-6 w-28 rounded" />
          <Skeleton className="h-3.5 w-64 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <StatSkeleton key={i} />)}
      </div>
      <div className="panel rounded p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="mt-6 h-56 w-full rounded-lg" />
      </div>
      <div className="panel overflow-hidden rounded p-4 sm:p-6">
        <Skeleton className="h-4 w-20 rounded" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid grid-cols-[minmax(180px,1.5fr)_repeat(4,minmax(70px,1fr))] items-center gap-4 border-b border-border pb-4 last:border-0">
              <Skeleton className="h-3.5 w-4/5 rounded" />
              {Array.from({ length: 4 }, (_, j) => <Skeleton key={j} className="ml-auto h-3.5 w-12 rounded" />)}
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

export function CampaignListSkeleton() {
  return (
    <LoadingRegion className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-4 w-28 rounded" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel rounded p-4 sm:p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-md" /><Skeleton className="h-5 w-20 rounded-md" /></div>
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <Skeleton className="h-2.5 w-1/2 rounded" />
                <div className="flex gap-4"><Skeleton className="h-3 w-14 rounded" /><Skeleton className="h-3 w-16 rounded" /><Skeleton className="h-3 w-14 rounded" /></div>
              </div>
              <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function CampaignDetailSkeleton() {
  return (
    <LoadingRegion className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
      <div className="space-y-6">
        <Skeleton className="h-4 w-24 rounded" />
        <div className="flex items-center gap-3"><Skeleton className="h-6 w-48 rounded" /><Skeleton className="h-5 w-16 rounded-full" /></div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-3.5 w-36 rounded" />
            <div className="panel rounded p-4"><Skeleton className={`${i === 0 ? "h-14 w-14" : "h-10 w-full"} rounded-lg`} /></div>
          </div>
        ))}
      </div>
      <div className="space-y-5">
        <div className="flex gap-2"><Skeleton className="h-10 w-28 rounded-lg" /><Skeleton className="h-10 w-28 rounded-lg" /></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></div>
        <div className="panel rounded p-5"><Skeleton className="h-4 w-32 rounded" /><Skeleton className="mt-6 h-52 w-full rounded-lg" /></div>
      </div>
    </LoadingRegion>
  );
}

export function CampaignBuilderSkeleton() {
  return (
    <LoadingRegion className="space-y-6">
      <div className="flex items-center justify-between"><Skeleton className="h-5 w-36 rounded" /><Skeleton className="h-9 w-28 rounded-lg" /></div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-7">
          {Array.from({ length: 5 }, (_, i) => (
            <section key={i} className="space-y-3">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className={`${i === 2 ? "h-28" : "h-11"} w-full rounded-lg`} />
              {i === 1 && <div className="grid grid-cols-3 gap-2"><Skeleton className="h-9 rounded-lg" /><Skeleton className="h-9 rounded-lg" /><Skeleton className="h-9 rounded-lg" /></div>}
            </section>
          ))}
        </div>
        <div className="panel rounded-xl p-5"><Skeleton className="h-4 w-24 rounded" /><Skeleton className="mx-auto mt-8 h-24 w-24 rounded-full" /><Skeleton className="mx-auto mt-5 h-4 w-36 rounded" /><Skeleton className="mt-8 h-32 w-full rounded-xl" /></div>
      </div>
    </LoadingRegion>
  );
}

export function InboxSkeleton() {
  return (
    <LoadingRegion className="space-y-4">
      <div className="flex items-end justify-between gap-4"><Skeleton className="h-6 w-24 rounded" /><Skeleton className="h-10 w-36 rounded-lg" /></div>
      <div className="grid h-[calc(100dvh-11rem)] grid-cols-1 overflow-hidden rounded border border-border sm:grid-cols-[300px_1fr]">
        <div className="border-b border-border sm:border-b-0 sm:border-r">
          <div className="border-b border-border px-4 py-3"><Skeleton className="h-4 w-32 rounded" /></div>
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded-lg p-3"><div className="flex justify-between gap-2"><Skeleton className="h-3.5 w-28 rounded" /><Skeleton className="h-2.5 w-10 rounded" /></div><Skeleton className="mt-2 h-3 w-4/5 rounded" /></div>)}
          </div>
        </div>
        <div className="hidden space-y-4 p-5 sm:block"><Skeleton className="h-4 w-32 rounded" /><div className="space-y-3 pt-8"><Skeleton className="h-10 w-2/3 rounded-2xl" /><Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" /><Skeleton className="h-16 w-3/5 rounded-2xl" /></div><Skeleton className="mt-auto h-11 w-full rounded-lg" /></div>
      </div>
    </LoadingRegion>
  );
}

export function SettingsSkeleton() {
  return (
    <LoadingRegion className="mx-auto max-w-2xl space-y-8">
      {Array.from({ length: 4 }, (_, i) => (
        <section key={i} className="panel rounded p-4 sm:p-6">
          <Skeleton className="h-5 w-40 rounded" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: i === 1 ? 3 : 2 }, (_, j) => <div key={j} className="flex items-center justify-between gap-4 border-b border-border pb-4 last:border-0"><div className="space-y-2"><Skeleton className="h-3.5 w-40 rounded" /><Skeleton className="h-2.5 w-56 rounded" /></div><Skeleton className="h-9 w-24 rounded-lg" /></div>)}
          </div>
        </section>
      ))}
    </LoadingRegion>
  );
}

export function ContactsSkeleton() {
  return (
    <LoadingRegion className="space-y-5">
      <div className="flex items-end justify-between gap-3"><div className="space-y-3"><Skeleton className="h-6 w-28 rounded" /><Skeleton className="h-3.5 w-72 rounded" /></div><Skeleton className="h-10 w-32 rounded-lg" /></div>
      <div className="panel rounded p-4 sm:p-5"><div className="mb-5 flex justify-between gap-3"><Skeleton className="h-10 w-56 rounded-lg" /><Skeleton className="h-10 w-72 rounded-lg" /></div><Skeleton className="mb-5 h-3.5 w-24 rounded" /><div className="space-y-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="grid grid-cols-4 gap-4 border-b border-border pb-4"><Skeleton className="h-3.5 w-4/5 rounded" /><Skeleton className="h-3.5 w-3/5 rounded" /><Skeleton className="h-3.5 w-4/5 rounded" /><Skeleton className="ml-auto h-3.5 w-24 rounded" /></div>)}</div></div>
    </LoadingRegion>
  );
}

export function DiagnosticsSkeleton() {
  return (
    <LoadingRegion className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between"><div className="space-y-3"><Skeleton className="h-7 w-56 rounded" /><Skeleton className="h-3.5 w-96 rounded" /></div><Skeleton className="h-10 w-24 rounded-lg" /></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <StatSkeleton key={i} />)}</div>
      {Array.from({ length: 3 }, (_, i) => <section key={i} className="panel rounded p-4 sm:p-6"><Skeleton className="h-4 w-44 rounded" /><div className="mt-5 space-y-4">{Array.from({ length: i === 0 ? 3 : 2 }, (_, j) => <div key={j} className="space-y-2 border-b border-border pb-4 last:border-0"><Skeleton className="h-3.5 w-3/4 rounded" /><Skeleton className="h-2.5 w-1/2 rounded" /></div>)}</div></section>)}
    </LoadingRegion>
  );
}
