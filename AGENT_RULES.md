# CampusPlace standing rules

1. Start of every task: read PROJECT_CONTEXT.md and this file. Each phase begins with a written plan; STOP and wait for my approval before writing code.
2. Security: every API route uses the central permission policy and has route-level tests; the route-guard scan test must keep passing. Students may only access their own record, with identity derived from the session, never from request params or body. Whitelist editable fields per role (no mass assignment). Validate input with Zod. Never log passwords, hashes, tokens, or personal data. Audit-log sensitive actions: exports, status changes, deletions, role/user changes, overrides.
3. Data: Student.department (config codes) is the single source of truth. Migrations are idempotent, dry-run by default, print the target DB host and name, require typed confirmation to apply, and never delete data. You never connect to, seed, or modify a remote or production database, and never run scripts/seed.ts. Add indexes for every new query pattern. All list endpoints are server-side paginated.
4. Config: college-specific values (departments, thresholds, policies, tiers, contact details, logo) live in config files. Mark guesses as UNVERIFIED. Never invent statistics, company names, accreditation claims, placement policies, or legal text; use clearly marked placeholders for the college to review.
5. Time: store UTC; display and enforce deadlines in Asia/Kolkata.
6. UI: use the existing design-system components only; mobile-first; skeletons and empty states; no native alert/confirm; no fake or hardcoded data; accessible (labels, focus, contrast).
7. Quality: npm test, npm run lint and npm run build must pass before you report. Small commits with clear messages. Never commit secrets, .env files, backups, or personal data. Do not push unless I say so.
8. End of every phase, report: files changed, new env vars, migrations and manual production steps in order, tests added, what was NOT verified or could not be tested, and regenerate PROJECT_CONTEXT.md. Then STOP.
9. Honesty: never claim something is verified unless you ran it. State assumptions and open questions explicitly.
