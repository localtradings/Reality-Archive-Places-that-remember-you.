# Tool Use and Research Warning

Codex must use available tools intelligently. Research official docs before changing code that depends on current SDKs/APIs such as Apple MapKit, SwiftUI, SwiftData, Supabase, PostHog, Sentry, XcodeGen, TestFlight, or App Store Connect. Plan before coding. Use repo search before editing. Use shell to build/test. Use browser only when useful. Use computer use only for UI/Xcode/simulator verification when needed. Do not use tools for billing/payment pages or sensitive account areas.

If a tool is unavailable, say so. Do not pretend to have used it. Do not guess APIs or rules without verification when verification is available.

# Financial Safety Warning

Codex must never access, use, edit, add, remove, or view my payment methods or billing pages. Codex must never buy, subscribe, upgrade, start a paid trial, activate billing, enable paid APIs, create paid products, charge cards, refund payments, connect bank/payout accounts, or spend money.

For any action that could cost money, Codex must stop and wait until I write exactly:

`I approve this paid action.`

Travel Search MVP has no payments, no ads, no subscriptions, no premium gating, no paid API activation, no Stripe, no Apple In-App Purchases, no Google Play Billing, no billing tables, and no checkout. Codex may only provide manual instructions or safe free-tier setup guidance.

# Payment Safety Warning

Travel Search MVP has no payments, no ads, and no premium gating. Codex must not add payment SDKs, Stripe, Apple In-App Purchase, subscriptions, paid plans, upgrade buttons, billing tables, live checkout, refunds, payouts, or pricing changes unless I explicitly say:

`I approve this real payment/billing action.`

Any payment work must default to sandbox/test mode and planning only. Never commit live payment secrets, webhook secrets, App Store private keys, bank details, tax IDs, or card data.

# Database Safety Warning

Codex must never delete, reset, truncate, drop, wipe, overwrite, or destructively modify any database, table, schema, storage bucket, auth users, seed data, or production/staging data unless I explicitly say:

`I approve this destructive database action.`

Before any database operation, Codex must identify the target environment, database/project, affected tables, operation type, whether it is destructive, whether a backup exists, and whether RLS or service role keys are involved.

If anything is unknown, stop and ask. Treat unknown remote databases as production. Never run `supabase db reset`, `DROP`, `TRUNCATE`, or unsafe `DELETE/UPDATE` commands without explicit approval.

# Critical Database Safety Rules

## Absolute Rule
Never delete, reset, truncate, drop, wipe, overwrite, or destructively modify any database, table, schema, bucket, auth user list, storage object, production data, staging data, or seed data unless I explicitly request that exact destructive action in the current chat.

If there is any uncertainty, stop and ask before doing anything.

## Forbidden Actions Without Explicit Approval

Codex must NOT run or generate commands like these unless I explicitly approve them:

- `DROP DATABASE`
- `DROP SCHEMA`
- `DROP TABLE`
- `TRUNCATE`
- `DELETE FROM` without a safe `WHERE`
- `DELETE FROM` affecting all rows
- `UPDATE` without a safe `WHERE`
- `supabase db reset`
- `supabase db push --include-all`
- `supabase migration repair`
- `supabase db diff` followed by destructive migration
- `prisma migrate reset`
- `rails db:reset`
- `rails db:drop`
- `sequelize db:migrate:undo:all`
- deleting Supabase Storage buckets
- deleting Auth users
- deleting production rows
- replacing production seed data
- overwriting `.env`, `.env.production`, `.env.local`, `.xcconfig`, or config files containing real values
- running scripts that modify remote Supabase data unless approved

## Production and Remote Database Protection

Treat every remote database as production unless clearly proven otherwise.

Before touching any database, Codex must identify:

1. Which environment is being used:
   - local
   - development
   - staging
   - production

2. Which database/project is targeted.

3. Whether the operation is:
   - read-only
   - additive
   - update
   - destructive

4. Whether a backup exists.

5. Whether the command uses safe limits or safe `WHERE` clauses.

If the environment is unknown, assume it is production and do not proceed.

## Migration Rules

Migrations must be additive by default.

Allowed without special approval:

- `CREATE TABLE`
- `CREATE INDEX`
- `ALTER TABLE ADD COLUMN`
- `ALTER TABLE ADD CONSTRAINT`
- `CREATE POLICY`
- `CREATE VIEW`
- adding non-destructive seed data
- safe inserts/upserts with natural keys

Requires explicit approval:

- dropping tables
- dropping columns
- renaming columns
- changing column types
- deleting records
- truncating records
- changing RLS policies in a way that exposes data
- disabling RLS
- deleting storage files
- modifying Auth users

## Supabase-Specific Rules

Never put the Supabase service role key in:

- iOS app
- Swift files
- `.xcconfig`
- committed `.env`
- frontend code
- public GitHub repository

The service role key may only be used in trusted local scripts or backend environments, and only when I explicitly approve the exact operation.

Never run seed/import scripts against a remote Supabase project unless I confirm:

- the target project
- the environment
- the script name
- the expected tables affected
- whether the operation is insert-only, upsert, update, or delete

## Data Deletion Rule

If a task requires deleting data, Codex must stop and show me:

1. The exact data that would be deleted.
2. The exact SQL/command/script.
3. The target environment.
4. The backup/rollback plan.
5. A safer alternative.
6. A confirmation prompt.

Do not proceed until I reply with:

`I approve this destructive database action.`

No other wording counts as approval.

## Safe SQL Rules

Every `UPDATE` or `DELETE` must have:

- a specific `WHERE` clause
- expected affected row count
- a preview/select query first

Before any update/delete, generate a preview query:

```sql
SELECT * FROM table_name WHERE condition;
```

# Financial Account and Payment Access Safety Rules

## Absolute Rule
Codex must never access, use, edit, create, test, connect, authorize, subscribe, upgrade, purchase, pay, charge, refund, transfer, withdraw, or spend money using any of my accounts.

This includes personal accounts, business accounts, developer accounts, cloud accounts, payment accounts, bank accounts, app store accounts, and subscription accounts.

Codex must not perform any action that could cost money unless I explicitly approve the exact action in the current chat.

## Required Approval Phrase

For any action that could cost money, Codex must stop and wait until I write exactly:

`I approve this paid action.`

No other wording counts as approval.

## Forbidden Without Explicit Approval

Codex must NOT:

- buy anything
- subscribe to anything
- upgrade any plan
- start a paid trial
- activate billing
- add, edit, remove, access, or view a payment method
- use Apple Pay, Google Pay, PayPal, or Stripe live mode
- connect bank or payout accounts
- create or pay invoices
- refund payments
- cancel paid subscriptions
- change pricing or tax settings
- enable paid APIs, cloud services, database plans, AI usage, maps, geocoding, email, SMS, storage, or CDN usage
- upgrade Supabase, Vercel, Cloudflare, PostHog, Sentry, OpenAI, Apple Developer, Google Cloud, AWS, Azure, Stripe, RevenueCat, or any other service
- create real in-app purchases, subscriptions, paid features, or deployments that can charge users or me

## Account Access Rule

Codex must not log in to, open, modify, or configure billing/payment pages for any service, including Apple Developer, App Store Connect banking/tax, Supabase, Vercel, Cloudflare, Google Cloud, AWS, Azure, OpenAI, PostHog, Sentry, Stripe, PayPal, RevenueCat, bank, credit card, or subscription management portals.

Codex may only provide instructions for me to do these manually.

## Payment Method Protection

Codex must never request, read, store, print, log, copy, screenshot, or use payment card details, bank details, payment credentials, live Stripe secrets, webhook signing secrets, App Store Connect private keys, tax IDs, payout information, or invoices containing sensitive billing data.

If payment information appears in a file, screenshot, terminal output, browser page, or tool response, Codex must ignore it and must not repeat it.

## Free-Tier Safety Rule

Codex may use or configure free-tier services only if doing so does not require adding a payment method, activating billing, starting a paid trial, or risking automatic charges.

If a free tier requires a credit card or can auto-upgrade or auto-charge, Codex must stop and ask first.

## Cloud and API Cost Rule

Codex must treat AI APIs, map APIs, geocoding APIs, email APIs, SMS APIs, push notification services, cloud functions, server hosting, database upgrades, storage, CDN bandwidth, analytics overages, error-monitoring overages, build minutes, image generation APIs, OCR APIs, and scraping/search APIs as potentially paid.

Before enabling any of these, Codex must state:

1. Service name
2. Whether billing is required
3. Whether a free tier exists
4. Whether a payment method is required
5. Possible charges
6. How to disable it
7. Safer free alternative

Then Codex must wait for my approval.

## Apple Developer and TestFlight Rule

Codex must not purchase Apple Developer Program membership or pay Apple fees. Codex may only give me manual instructions.

Codex must not access Apple billing, banking, tax, contracts, paid agreements, or payment method pages.

## Travel Search MVP Rule

For Travel Search right now:

- no payments
- no ads
- no paid subscriptions
- no premium gating
- no paid API activation
- no automatic upgrades
- no live Stripe
- no Apple In-App Purchases
- no Google Play Billing
- no billing tables
- no paid plan UI
- no Upgrade button
- no checkout
- no payment SDKs

Everything must stay free for MVP unless I explicitly approve otherwise.

## Safe Allowed Actions

Codex may:

- write setup instructions
- create checklists
- create placeholder config keys
- write documentation explaining where I manually add keys
- write sandbox/test-only code with no real billing
- create mock payment UI only if clearly labeled disabled and not connected
- explain pricing based on public documentation
- warn me about possible costs

Codex must not actually perform paid actions.

## If Unsure

Stop and ask first.

Treat any action involving money, billing, accounts, subscriptions, paid APIs, developer memberships, cloud services, or payment methods as high-risk.

# Codex Tool, Research, Planning, and Debugging Rules

## Core Rule
Codex must use the best available tools, skills, plugins, and workflows only when they are useful for the task. Do not use tools randomly. Use tools to improve accuracy, verify assumptions, test behavior, debug issues, inspect UI, and reduce mistakes.

If a tool/plugin/skill is unavailable, Codex must say so and continue with the safest available method.

## Research-First Rule
Before implementing any task that depends on current APIs, frameworks, SDKs, Apple rules, Supabase behavior, PostHog, Sentry, MapKit, TestFlight, Xcode, SwiftUI, or any third-party package, Codex must research or verify the current documentation first when browser/web access is available.

This includes package versions, privacy/legal requirements, analytics, monitoring, payment or billing systems, database migrations, and security-sensitive code.

If browser/web access is unavailable, Codex must clearly state:

“Browser/web access is unavailable, so I will rely on the repository docs and installed package APIs only.”

## Source Priority
When researching, prefer official/primary sources first:

1. Apple Developer documentation
2. Supabase documentation
3. OpenAI/Codex documentation
4. PostHog documentation
5. Sentry documentation
6. Official GitHub repositories
7. Package README/release notes
8. Trusted issue discussions only when official docs are insufficient

Do not rely on random blogs unless no official source exists.

## Planning-First Rule
For any non-trivial task, Codex must plan first and wait for approval before coding.

Non-trivial tasks include new features, database changes, migrations, auth/security changes, MapKit changes, AI action changes, analytics/monitoring changes, offline storage changes, TestFlight/release changes, dependency changes, large refactors, and bug fixes touching multiple modules.

The plan must include:

- goal
- files to create/modify
- technical approach
- data/schema impact
- privacy/security impact
- tool usage needed
- tests to run
- risks/blockers
- what is explicitly out of scope

## Think-and-Recheck Rule
Before writing code, Codex must consider crashes, missing config, offline behavior, empty data, long text, private-data leakage, invalid database records, Release build failures, test failures, App Store/TestFlight problems, accidental cost, and accidental data deletion. Plans must include mitigations.

## Tool Use Rules

### Browser/Web Research
Use browser/web research when API behavior may have changed, package versions matter, official platform documentation is needed, release rules are involved, dependency errors require investigation, or current best practices and options need comparison.

Do not browse for purely local code changes that can be resolved by reading the repo.

### Computer Use
Use computer use only when needed for UI or GUI-only verification, such as iOS Simulator behavior, Xcode Signing & Capabilities, Xcode Organizer/archive state, visual layout bugs, local app/browser previews, or GUI-only reproduction.

Do not use computer use for billing, payment methods, banking, Apple Developer billing, App Store banking/tax, private keys, passwords, or account payment pages.

### Shell/Terminal
Use shell/terminal for reading files, running tests, building the app, checking git status, running xcodegen or xcodebuild, searching the repo, verifying generated files, and checking package resolution.

Before risky shell commands, run:

```sh
git status --short
```
