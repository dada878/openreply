import { getRedisConnection } from "./client";

// A successful public reply is a safe, low-volume probe that Meta is allowing
// this account to post again. Keep the signal short-lived so an old success
// cannot turn a later policy block into a retry storm.
const PROBE_TTL_SECONDS = 10 * 60;

function probeKey(instagramAccountId: string, credentialId?: string | null): string {
  return `instagram:public-reply-probe:${instagramAccountId}${credentialId ? `:${credentialId}` : ""}`;
}

export async function markPublicReplyProbeSuccess(
  instagramAccountId: string,
  credentialId?: string | null,
): Promise<void> {
  await getRedisConnection().set(
    probeKey(instagramAccountId, credentialId),
    new Date().toISOString(),
    "EX",
    PROBE_TTL_SECONDS,
  );
}

export async function hasRecentPublicReplyProbe(
  instagramAccountId: string,
  credentialId?: string | null,
): Promise<boolean> {
  return Boolean(await getRedisConnection().exists(probeKey(instagramAccountId, credentialId)));
}

export async function clearPublicReplyProbe(
  instagramAccountId: string,
  credentialId?: string | null,
): Promise<void> {
  await getRedisConnection().del(probeKey(instagramAccountId, credentialId));
}
