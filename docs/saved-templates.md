# Saved campaign templates

**My templates** is a workspace library of reusable reply flows. It is separate
from the public, built-in examples at `/templates`.

## Use a template

1. Open **My templates** and choose **New template**, or open a campaign editor
   and choose **Save as template**. Saving from a campaign includes the current
   form values, including unsaved edits; it does not change the campaign.
2. Name the template and save it. No connected Instagram account or selected post
   is needed to create a template.
3. Choose **Use template**. Review the account, choose a post if using a specific
   post trigger, and adjust keywords, messages and destination URLs.
4. Choose **Save paused** to prepare the campaign, or **Go Live** to activate it.
   Merely opening a template does not create or activate a campaign.

The library supports searching by name, editing (including renaming), and
deleting with confirmation. Workspace members can view templates; owners and
admins can manage and use them. Changes and deletions never change existing
campaigns.

## What is saved

- Trigger scope, keywords, whole-word matching and DM triggers.
- Public reply variants, opening DM and its button.
- Final DM, both destination URLs and button labels.
- Follow requirement, follow prompt and confirmation button.
- Follow-up message and delay.
- Text entered in disabled steps, so it is available when a step is re-enabled.

Templates do not store account IDs, post IDs/URLs, active state, tracking slugs,
report links or analytics. Each campaign uses the existing campaign creation API
to generate its own tracking/report links. Message placeholders such as `{link}`
and `{username}` are preserved verbatim. Changing the interface language leaves
saved content and unsaved form values unchanged.

## Storage and validation

Apply migrations with `npm run db:migrate`, then generate the Prisma client with
`npm run db:generate`. `CampaignTemplate` belongs to a workspace and contains a
versioned JSON configuration validated by `lib/templates/saved-schema.ts`.
Reads and writes are scoped to the authenticated workspace; unknown fields are
stripped before persistence. Workspace deletion cascades to its templates.

The tests cover the configuration contract and permissions. With
`TEST_DATABASE_URL` set, they also apply all migrations in a disposable Postgres
schema and verify persistence, isolation, independent campaign tracking links
and deletion behavior. No Instagram delivery runs during these tests.
