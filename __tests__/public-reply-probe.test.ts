import { beforeEach, expect, it, vi } from "vitest";
const { values, redis } = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    redis: {
      set: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      exists: vi.fn(async (key: string) => Number(values.has(key))),
      del: vi.fn(async (key: string) => values.delete(key)),
    },
  };
});
vi.mock("@/lib/queue/client", () => ({ getRedisConnection: () => redis }));
import {
  markPublicReplyProbeSuccess,
  hasRecentPublicReplyProbe,
  clearPublicReplyProbe,
} from "@/lib/queue/public-reply-probe";
beforeEach(() => {
  values.clear();
  vi.clearAllMocks();
});
it("keeps recovery signals separate for each account and credential", async () => {
  await markPublicReplyProbeSuccess("account-1", "key-B");
  expect(await hasRecentPublicReplyProbe("account-1", "key-B")).toBe(true);
  expect(await hasRecentPublicReplyProbe("account-1", "key-A")).toBe(false);
  expect(await hasRecentPublicReplyProbe("account-1")).toBe(false);
  expect(await hasRecentPublicReplyProbe("account-2", "key-B")).toBe(false);
  await clearPublicReplyProbe("account-1", "key-A");
  expect(await hasRecentPublicReplyProbe("account-1", "key-B")).toBe(true);
  await clearPublicReplyProbe("account-1", "key-B");
  expect(await hasRecentPublicReplyProbe("account-1", "key-B")).toBe(false);
});
it("retains the legacy key for campaigns using the default connection", async () => {
  await markPublicReplyProbeSuccess("account-1");
  expect(redis.set).toHaveBeenCalledWith(
    "instagram:public-reply-probe:account-1",
    expect.any(String),
    "EX",
    600,
  );
  expect(await hasRecentPublicReplyProbe("account-1", null)).toBe(true);
});
