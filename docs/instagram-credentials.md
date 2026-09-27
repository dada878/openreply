# Campaign Instagram credentials

Settings → Instagram API credentials stores additional Instagram Login access
tokens for an already connected Meta account. Each campaign can select a named
credential or keep the account's default connection. A campaign targeting a
specific video therefore controls the credential used for that video's replies.

Create the additional Meta app under the same business portfolio, enable its
Instagram use case, and authorize the same professional Instagram account. Save
its Instagram Login token and App ID in OpenReply. The App ID is a label supplied
by the administrator; the API verifies account ownership through `me.user_id`.
An app-scoped `me.id` or a matching username is not accepted as proof of ownership.

The new app needs permissions appropriate to the campaign: Instagram basic
access, comment management, and messaging if private replies are enabled.
“Test connection” confirms token validity and account identity using a read-only
request. Only an authorized real reply can verify write permissions and whether
Meta currently permits that action. Multiple tokens do not guarantee independent
quotas or removal of account-level restrictions.

## Behavior

- Tokens are encrypted using the existing AES-GCM token storage. List, create,
  and test responses return metadata only, never tokens or fingerprints.
- Only workspace owners and administrators may save, test, or remove tokens.
  Campaign assignments are checked against the same workspace and IG account.
- Public replies, private replies, follow-up messages, follow checks, email
  capture, and campaign comment polling use the selected token. General account
  browsing and manual inbox actions retain the default connection.
- Existing webhooks remain the inbound path; registering an additional outgoing
  token does not create duplicate webhook subscriptions.
- A missing or expired selected token fails without falling back to another
  token. Switching is explicit; there is no automatic token rotation on 368.
- Recovery signals and polling token caches are separated by credential, so a
  success using one app does not release another app's blocked backlog.
- Tokens with a known expiry refresh within ten days of expiry. Imported tokens
  with unknown expiry first refresh after a week. Refresh failures appear in
  operational events. Expired/revoked tokens may need reauthorization in Meta.
- A credential referenced by any campaign cannot be removed. Switch those
  campaigns first. Deleting an Instagram account removes its credentials with
  the rest of its account data.
- Templates stay account-independent. Duplicating a campaign preserves its
  explicit credential, and the copy starts paused.

Deploy the included Prisma migration before serving the updated application.
Existing campaigns receive a null selection and continue using their default
connection.
