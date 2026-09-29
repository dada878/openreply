# Shared follow-ups

Create named promotions under **Shared follow-ups** in the sidebar. A workspace can keep multiple saved groups and activate one at a time. An active shared group applies to every campaign and replaces its campaign-specific follow-up. Creating a group defaults to paused.

Each group has 1–10 entries with a product/variant name, message, optional HTTP(S) destination and button label. `{username}` personalizes the message. Random selection chooses one entry and can repeat; sequential selection rotates separately for each recipient/account. The repeat toggle defaults off, reserving one delivery attempt per group/account/recipient; enabling it permits subsequent resource-completion events. Repeated webhook events never create a second delivery for the same source event.

The default delay is three minutes after successful resource delivery (configurable from 1 to 1440 minutes). Opening prompts, follow requirements, email prompts and public-only replies do not schedule promotions. Only inbound DMs or real postback interactions establish a local messaging window; comments and read receipts do not. The worker requires at least one minute remaining in the 24-hour window and otherwise records `SKIPPED_WINDOW`. It does not reconstruct windows for interactions before this feature was installed. Meta can still reject a send.

Delivery receipts persist in PostgreSQL before queueing; a worker sweep recovers due receipts every 15 seconds. Each receipt stores its selected content and due time, so editing a promotion affects future receipts. Pause, archive or switching the active group cancels pending deliveries; already claimed sends cannot be recalled. Cancelled, failed and skipped attempts still count toward the once-per-person setting. Re-enabling a group does not resurrect old deliveries or clear its history.

An atomic claim prevents concurrent sends. Ambiguous provider/network outcomes and persistence failures after sending become `UNCONFIRMED`; they are not retried automatically. Claims left behind after a worker crash become unconfirmed after ten minutes. A scheduling failure is logged separately and never retries the already-delivered resource. Scheduling is not atomic with the external Instagram send: worker/database failures in that gap may omit a promotion, rather than risk repeating the resource.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. To verify migration constraints against an isolated migrated PostgreSQL database, set `FOLLOWUP_TEST_DATABASE_URL` while running `__tests__/shared-followups.integration.test.ts`. Never point this at production. The test creates and removes only its own random fixture owner/workspace.
