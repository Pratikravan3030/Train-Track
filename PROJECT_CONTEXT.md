# PROJECT_CONTEXT.md

## Technical Handoff & Architecture Guide
**Repository / Application Name**: CampusPlace  
**Package Name**: `campusplace` ([package.json](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/package.json#L2))  
**Institution**: D.Y. Patil College of Engineering & Technology (DYPCET), Kasaba Bawada, Kolhapur, Maharashtra  
**Document Generated / Updated**: 2026-10-09  
**Target Audience**: Senior Engineers, AI Coding Agents (Antigravity), Technical Leads, and System Operators  

---

## 1. PROJECT OVERVIEW

### Core Purpose & Problem Domain
CampusPlace is a secure, multi-tenant Training & Placement (T&P) Management System tailored for **D.Y. Patil College of Engineering & Technology (DYPCET), Kolhapur**. It unifies student cohort tracking, training session scheduling, digital attendance marking, session feedback, and placement analytics into a single institutional portal.

Prior to CampusPlace, placement officers, department faculty coordinators, and trainers maintained disconnected spreadsheets, manual paper rosters, and offline feedback surveys. This resulted in fragmented student placement eligibility records, non-standard department naming conventions, security vulnerabilities, and slow report generation for NAAC/NIRF compliance.

### System Capabilities
- **Centralized Student Roster**: Canonical tracking of students across all academic branches (`CSE`, `IT`, `ECE`, `EE`, `ME`, `CE`, `OTHER`) and academic years (`First Year` through `Final Year`).
- **Standardized Department Identity**: Strict enum validation (`DEPARTMENT_CODES`) where `Student.department` is the single source of truth, replacing free-text strings.
- **Training Session Management**: Curriculum, scheduling, venue, and trainer tracking for technical bootcamps, aptitude workshops, and soft-skill modules.
- **Digital Bulk Attendance**: Fast checkbox/batch attendance recording with cross-department isolation safeguards.
- **Quantitative & Qualitative Feedback**: 1–5 star ratings and textual reviews with student attribution and duplicate prevention (one feedback per student per session).
- **Institution Analytics**: Server-side MongoDB aggregations for real-time placement statistics, attendance rates, and rating distributions.
- **Administrative User Lifecycle**: Self-service user provisioning, temporary password issuance, forced first-login password changes, instant session revocation, and audit logging.

### Current Maturity Level: Production-Ready Placement Drives, Eligibility Engine & Offer Workflow (Phases 1, 2, 3a, & 4 Implemented; Phase 3b Backlog Tracked)
- **Status**: Production-ready core backend, institutional placement drive pipeline, eligibility engine, offer workflow, and pluggable cloud storage adapter. (Note: Phase 3 is not described as complete; missing student profile extension items are tracked under Phase 3b backlog).
- **Security & Authorization**: Default-deny central RBAC policy across all API routes, token-version session invalidation, server-side forced password change enforcement, and campus-NAT-tolerant anti-DOS rate limiting. Strict placement status governance (TPO/Admin only with mandatory reason when de-listing from Placed status).
- **Batch Isolation**: All student lists, drives, imports, exports, and dashboard metrics strictly partition by `passoutYear` (batch) defaulting to `DEFAULT_PASSOUT_YEAR` (`2026`) so adjacent cohorts never mix.
- **Pluggable Storage Adapter**: S3/R2-compatible storage with private bucket ACLs, 2MB PDF size limit, magic byte validation (`%PDF-`), serving safely with `X-Content-Type-Options: nosniff`. Production fail-safe disables uploads if `STORAGE_PROVIDER=local` in production or Vercel.
- **Placement & Eligibility Engine**: Server-side academic eligibility evaluator with explicit `"not recorded"` reason for null fields, IST registration deadline enforcement, offer tier progression validation, and automatic offer reversal synchronization.
- **Data Integrity**: Formula-safe CSV exports (escapes leading `=`, `+`, `-`, `@`, `\t`, `\r`), two-step shortlist workflow (`/preview` and `/confirm` with idempotency).
- **Tests**: Fully automated in-memory MongoDB test suite (12 test files, 232 automated tests) executing via Vitest.
- **Code Quality**: Zero ESLint errors, zero TypeScript errors (`npm run build` and `npm run lint` passing 100%).

---

## 2. TECH STACK & CONFIGURATION

| Layer | Technology | Version / Details | File Reference |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | v20+ recommended (ES2017+ target) | [tsconfig.json](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/tsconfig.json) |
| **Language** | TypeScript | `^5` (Strict type checking, no `any`) | [tsconfig.json](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/tsconfig.json) |
| **Framework** | Next.js | `16.2.10` (App Router architecture) | [package.json](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/package.json) |
| **UI Library** | React / React DOM | `19.2.4` | [package.json](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/package.json) |
| **Styling** | Tailwind CSS v4 | PostCSS `@tailwindcss/postcss` | [postcss.config.mjs](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/postcss.config.mjs) |
| **Icons** | Lucide React | `^1.25.0` | [package.json](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/package.json) |
| **Charts** | Recharts | `^3.9.2` | [package.json](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/package.json) |
| **Validation** | Zod | `^3.24.2` (Strict schemas for all API inputs) | [src/lib/validations/](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/lib/validations/) |
| **Database** | MongoDB Atlas / Local | Mongoose `^9.7.4` | [src/lib/db.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/lib/db.ts) |
| **Authentication** | NextAuth.js | `^4.24.14` (JWT strategy, 24h maxAge) | [src/app/api/auth/[...nextauth]/route.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/app/api/auth/%5B...nextauth%5D/route.ts) |
| **Password Hashing** | bcryptjs | `^3.0.3` (10 salt rounds) | [src/app/api/auth/change-password/route.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/app/api/auth/change-password/route.ts) |
| **Testing** | Vitest | `^3.2.7` with `mongodb-memory-server` `^11.3.0` | [vitest.config.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/vitest.config.ts) |
| **Code Tooling** | tsx | `^4.23.1` (Direct script execution) | [package.json](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/package.json) |

---

## 3. DIRECTORY STRUCTURE

```
/Users/pratikravan/Desktop/Placement Coordination Dashboard/
├── .env.example                          # Environment variable template
├── eslint.config.mjs                     # ESLint flat config
├── next.config.ts                        # Next.js configuration
├── package.json                          # Dependencies & NPM scripts
├── postcss.config.mjs                    # PostCSS config with Tailwind v4
├── README.md                             # Production deployment & operations guide
├── tsconfig.json                         # Strict TypeScript configuration
├── vitest.config.ts                      # Vitest configuration for in-memory DB tests
│
├── public/                               # Static images, logos, and robots.txt
├── scripts/
│   ├── migrate-department-codes.ts       # Idempotent department code migration with safety confirmation
│   ├── seed-admin.ts                     # Idempotent super admin bootstrap seeder
│   └── seed.ts                           # Development demo data seeder
│
├── tests/
│   ├── authorization.test.ts             # Central permission matrix unit tests (26 tests)
│   ├── departmentMapper.test.ts          # Department code mapping & normalization tests (6 tests)
│   ├── rate-limit.test.ts                # Campus NAT rate limiting & zero-sleep backoff tests (12 tests)
│   ├── route-authorization.test.ts       # Route handlers, cross-dept scoping & gap tests (66 tests)
│   └── user-management.test.ts           # Admin user lifecycle & password policy tests (14 tests)
│
└── src/
    ├── app/                              # Next.js App Router
    │   ├── admin/users/page.tsx          # Staff user management UI (Super Admin only)
    │   ├── api/
    │   │   ├── admin/users/              # User list, create, update, delete, reset-password
    │   │   ├── attendance/               # Attendance GET & POST (scoped by department)
    │   │   ├── auth/                     # NextAuth handler & /api/auth/change-password
    │   │   ├── dashboard-stats/          # Server-side aggregation KPIs
    │   │   ├── feedback/                 # Feedback GET & POST (one-per-student-session)
    │   │   ├── health/                   # Diagnostic endpoint (SUPER_ADMIN only)
    │   │   ├── search/                   # Global header search (scoped by role)
    │   │   ├── sessions/                 # Training sessions CRUD & scoped rosters
    │   │   └── students/                 # Students CRUD with pagination & filter
    │   ├── feedback/page.tsx             # Feedback overview & submission
    │   ├── login/page.tsx                # Institutional login portal
    │   ├── page.tsx                      # Main dashboard with server-side KPIs
    │   ├── sessions/page.tsx             # Training sessions management
    │   └── students/page.tsx             # Student directory & department filter
    │
    ├── components/                       # React UI Components
    │   ├── ui/                           # Reusable design token primitives
    │   │   ├── Badge.tsx                 # Status & department tag badges
    │   │   ├── Button.tsx                # Accessible buttons with variants & loading state
    │   │   ├── ConfirmDialog.tsx         # Accessible modal replacing native confirm()
    │   │   ├── EmptyState.tsx            # Clean fallback when no data exists
    │   │   ├── Modal.tsx                 # Focus-trapped accessible dialog
    │   │   ├── Skeleton.tsx              # Pulse loading skeletons
    │   │   ├── Table.tsx                 # Accessible data table with pagination controls
    │   │   └── ToastContext.tsx          # Toast notification provider replacing alert()
    │   ├── DashboardCharts.tsx           # Department & year breakdown charts
    │   ├── Footer.tsx                    # Institutional footer with DYPCET metadata
    │   ├── ForceChangePasswordModal.tsx  # Server-forced password change modal
    │   ├── Header.tsx                    # Global navigation & live search
    │   ├── LayoutWrapper.tsx             # Shell wrapper with role-based navigation
    │   ├── Providers.tsx                 # NextAuth & Toast Context wrappers
    │   └── Sidebar.tsx                   # Role-filtered sidebar navigation
    │
    ├── config/
    │   └── collegeConfig.ts              # Institutional configuration (DYPCET constants)
    │
    ├── lib/
    │   ├── audit.ts                      # Security & operational audit logger
    │   ├── auth-guards.ts                # Session validation, DB sync, RBAC route guards
    │   ├── db.ts                         # Cached MongoDB connection with serverless timeout
    │   ├── departmentMapper.ts           # Canonical department mapper & resolveStudentDepartment
    │   ├── permissions.ts                # Role x Resource x Action permission matrix
    │   ├── rate-limit.ts                 # Campus NAT rate limiter with zero-sleep backoff
    │   └── validations/                  # Zod validation schemas
    │       ├── common.ts                 # Pagination query schemas
    │       ├── student.ts                # Student create/update schemas
    │       ├── trainingSession.ts        # Session schemas
    │       └── user.ts                   # User provisioning & password complexity schemas
    │
    ├── models/                           # Mongoose Schemas & Models
    │   ├── Attendance.ts                 # Attendance records with unique compound index
    │   ├── AuditLog.ts                   # Administrative audit log
    │   ├── Feedback.ts                   # Feedback entries with unique compound index
    │   ├── LoginAttempt.ts               # Rate limit tracking (IP spray, IP+email, email)
    │   ├── Student.ts                    # Student model (department single source of truth)
    │   ├── TrainingSession.ts            # Training session model
    │   └── User.ts                       # System user model with tokenVersion
    │
    ├── proxy.ts                          # Next.js 16 forward-compatible proxy hook
    └── types/
        └── next-auth.d.ts                # Extended NextAuth User, Session, and JWT types
```

---

## 4. ROLES & RBAC PERMISSION MATRIX

CampusPlace operates on a **Strict Default-Deny** model implemented in [src/lib/permissions.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/lib/permissions.ts) and enforced at runtime via `requirePermission()` in [src/lib/auth-guards.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/lib/auth-guards.ts).

### Defined Roles ([src/config/collegeConfig.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/config/collegeConfig.ts))
1. `SUPER_ADMIN`: Institutional administrator (IT Head, Principal). Full system access, user lifecycle management, and system health diagnostics.
2. `TPO`: Training & Placement Officer. Campus-wide academic access across all departments; restricted from creating/deleting admin users or viewing system health.
3. `DEPT_COORDINATOR`: Department Faculty Coordinator. Strictly scoped to their own department (`department: 'CSE'`). Cannot view or modify students, rosters, attendance, or feedback of other departments.
4. `STUDENT`: Enrolled student. Read-only access to published sessions; can submit their own session feedback (one per session); restricted from administrative rosters.
5. `RECRUITER`: Corporate recruiter (Future phase placeholder). Currently denied on administrative endpoints.

### Resource Permission Matrix

| Resource | Action | SUPER_ADMIN | TPO | DEPT_COORDINATOR | STUDENT | RECRUITER |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **students** | `create` | `all` | `all` | `own-department` | `none` | `none` |
| **students** | `read` | `all` | `all` | `own-department` | `none` | `none` |
| **students** | `update` | `all` | `all` | `own-department` | `none` | `none` |
| **students** | `delete` | `all` | `all` | `none` | `none` | `none` |
| **sessions** | `create` | `all` | `all` | `none` | `none` | `none` |
| **sessions** | `read` | `all` | `all` | `all` (Roster scoped) | `all` (No roster) | `all` |
| **sessions** | `update` | `all` | `all` | `none` | `none` | `none` |
| **sessions** | `delete` | `all` | `all` | `none` | `none` | `none` |
| **attendance** | `create` | `all` | `all` | `own-department` | `none` | `none` |
| **attendance** | `read` | `all` | `all` | `own-department` | `none` | `none` |
| **feedback** | `create` | `all` | `all` | `all` | `own-record` | `none` |
| **feedback** | `read` | `all` | `all` | `own-department` | `none` | `none` |
| **users** | `create` | `all` | `none` | `none` | `none` | `none` |
| **users** | `read` | `all` | `none` | `none` | `none` | `none` |
| **users** | `update` | `all` | `none` | `none` | `none` | `none` |
| **users** | `delete` | `all` | `none` | `none` | `none` | `none` |
| **audit_logs** | `read` | `all` | `none` | `none` | `none` | `none` |
| **health** | `read` | `all` | `none` | `none` | `none` | `none` |

---

## 5. USER MANAGEMENT & AUTHENTICATION HARDENING

### Session Invalidation & Token Versioning
To prevent revoked, deactivated, or compromised JWT sessions from lingering:
1. Every `User` document in MongoDB stores an integer `tokenVersion` (default `1`).
2. The user's active `tokenVersion` is baked into the NextAuth JWT token.
3. Every authenticated API request passes through `validateUserSession` in [src/lib/auth-guards.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/lib/auth-guards.ts):
   - Queries MongoDB to ensure user still exists (returns `401` if deleted).
   - Verifies `isActive === true` (returns `403` if account was deactivated).
   - Verifies `token.tokenVersion === user.tokenVersion` in the DB (returns `401` if session was invalidated).
4. `tokenVersion` is automatically bumped in:
   - User password change (`/api/auth/change-password`)
   - Administrative password reset (`/api/admin/users/[id]/reset-password`)
   - Account deactivation toggle (`PUT /api/admin/users/[id]`)
5. Session lifetime is capped to **24 hours** (`session.maxAge: 86400`).

### Server-Side Forced Password Change
1. New accounts provisioned by an administrator and accounts reset with temporary credentials are created with `mustChangePassword: true`.
2. On every protected API route, `validateUserSession` checks `mustChangePassword === true`. If true, the request is immediately rejected with HTTP `403 Forbidden` and `{ error: 'Password change required before accessing this resource.', code: 'PASSWORD_CHANGE_REQUIRED' }`.
3. The only endpoints permitted while `mustChangePassword === true` are:
   - `POST /api/auth/change-password`
   - NextAuth session endpoints (`/api/auth/session`, `/api/auth/csrf`)
4. When a user submits their new password:
   - Validates complexity via Zod (8+ chars, upper, lower, number, special char).
   - Asserts the new password does not match the previous password or the temporary password.
   - Clears `mustChangePassword = false`, sets new bcrypt hash, increments `tokenVersion`, and logs audit event.
   - [ForceChangePasswordModal.tsx](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/components/ForceChangePasswordModal.tsx) refreshes the client session (`update({ tokenVersion, mustChangePassword: false })`), instantly unlocking access without requiring re-login.

---

## 6. CAMPUS NAT RATE LIMITING & ANTI-DOS ARCHITECTURE

In a collegiate environment like DYPCET, thousands of student mobile devices and campus computer labs share a small pool of public IP addresses via **Network Address Translation (NAT)**. A naive IP-based rate limiter (e.g., locking an IP after 10 failed logins) would lock out the entire college campus when a few students mistype passwords.

CampusPlace implements a multi-tier rate limiting architecture in [src/lib/rate-limit.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/lib/rate-limit.ts):

### 1. Edge Proxy IP Extraction & Unidentified Client Fallback
- `extractClientIp` prioritizes un-spoofable edge headers: `x-vercel-forwarded-for` > `x-forwarded-for` > `x-real-ip`.
- If no client IP headers exist, it returns `null` (unidentified). It **never pools unidentified users into 127.0.0.1**, falling back to email-only limits instead.

### 2. Multi-Key Failure Tracking
- **`(IP + email)` Pair Tracking**: Maximum 5 failures before progressive backoff is imposed on that specific device and account pair.
- **Account-Level Tracking (`email`)**: Maximum 5 failures across any network before account cooldown.
- **Campus NAT Spray Defense (`ip_spray`)**: Tracks the number of *distinct email accounts* targeted from a single IP. An IP is only locked if it targets **25 or more distinct accounts** (`IP_DISTINCT_EMAILS_THRESHOLD = 25`), isolating credential stuffing attacks while allowing campus NAT sharing.

### 3. Zero-Sleep Serverless Backoff
- **The Serverless Trap**: Calling `setTimeout()` inside a serverless function (Vercel) burns execution budget and exhausts concurrency limits during brute-force attacks.
- **Implementation**: The rate limiter calculates exponential backoff ($2^{\text{excess}}$ seconds, capped at 60s) and writes a `lockedUntil` timestamp to MongoDB.
- `checkRateLimit` immediately returns `{ allowed: false, reason: 'BACKOFF_REQUIRED', retryAfterSeconds: N }` in $<10\text{ms}$.
- NextAuth `authorize` rejects with `"Account security cooldown active. Please wait N seconds before retrying."` without stalling the serverless worker.

---

## 7. DEPARTMENT IDENTITY: SINGLE SOURCE OF TRUTH

### Canonical Codes
Standardized in [src/config/collegeConfig.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/config/collegeConfig.ts):
- `CSE` (Computer Science & Engineering)
- `IT` (Information Technology)
- `ECE` (Electronics & Telecommunication Engineering)
- `EE` (Electrical Engineering)
- `ME` (Mechanical Engineering)
- `CE` (Civil Engineering)
- `OTHER` (Unassigned / Other Departments)

### Single Source of Truth
- `Student.department` is strictly required and enum-validated against `DEPARTMENT_CODES` at the Mongoose level ([src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)).
- The legacy `pre('save')` sync hook has been removed.
- All creation, update, and import paths pass through `resolveStudentDepartment()` in [src/lib/departmentMapper.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/lib/departmentMapper.ts).
- `Student.branch` is **never written to** for new records; it is read strictly as a fallback for unmigrated legacy documents.

### Migration Script Safety Step ([scripts/migrate-department-codes.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/scripts/migrate-department-codes.ts))
1. Connects to database and displays:
   - Target Host (e.g. `cluster0.mongodb.net`)
   - Target Database Name (e.g. `campusplace`)
   - Affected Collections (`students`, `users`)
2. Reminds operator to create a full backup (`mongodump`).
3. In `--apply` mode, prompts the operator to type the target database name interactively to confirm before performing any database write.

---

## 8. AUTOMATED TEST SUITE

The project features 100% in-memory database testing using Vitest and `mongodb-memory-server`:

```bash
# Run complete test suite
npm test
```

| Test File | Test Count | Scope Covered |
| :--- | :--- | :--- |
| `tests/route-authorization.test.ts` | 72 tests | Real route handlers, role-based scope isolation, cross-department boundary testing, cascading deletions, forced password change 403 enforcement, session invalidation on deactivation/reset, and student department single source of truth validation. |
| `tests/authorization.test.ts` | 28 tests | Central RBAC policy matrix verification, default-deny enforcement, action and scope mapping across all roles. |
| `tests/drives-authorization.test.ts` | 18 tests | Companies CRUD & delete protection, Drives CRUD & batch cohort scoping, Eligible roster calculation, Registration with late/override audit reason, Duplicate application race condition prevention. |
| `tests/shortlist-and-offers.test.ts` | 15 tests | Two-step shortlist preview & confirm with idempotency, Offer issuance & policy tier check, Offer reversal & student status resynchronization, Formula-safe CSV export with formula injection escaping and DOB/gender exclusion, Offer letter PDF upload & download. |
| `tests/storage.test.ts` | 13 tests | Pluggable `StorageAdapter` architecture (`LocalDiskStorageAdapter`, `S3CompatibleStorageAdapter`), random UUID keys, 2MB size limit, PDF magic bytes verification, nosniff headers, production fail-safe when `STORAGE_PROVIDER=local`. |
| `tests/eligibilityEngine.test.ts` | 18 tests | Academic eligibility evaluator with explicit `"not recorded"` reason for null backlogs/cgpa/percentages, empty restriction handling, IST deadline validation, `evaluatePlacementPolicyCompliance` tier checks. |
| `tests/models-validation.test.ts` | 11 tests | Zod nullable preprocessors (blank string/null/undefined -> null, "0" -> 0) across API, Form, and CSV import schemas; no default 0 on backlogs. |
| `tests/user-management.test.ts` | 14 tests | Admin user provisioning, temporary password generation, password complexity checks, preventing reuse of current or temporary passwords, token version incrementation. |
| `tests/rate-limit.test.ts` | 12 tests | Edge proxy IP extraction, campus NAT multi-user tolerance, credential stuffing spray protection (25+ accounts), zero-sleep progressive backoff timing ($<100\text{ms}$ execution), unidentified IP handling, and limit resets. |
| `tests/passoutYearMigration.test.ts` | 11 tests | Passout year migration script, batch isolation, dry-run vs apply modes. |
| `tests/departmentMapper.test.ts` | 6 tests | Mapping variations (free-text variants, acronyms, case insensitivity), fallback behaviors, and enum schema validation. |
| `tests/api-protection-scan.test.ts` | 15 tests | Route-guard automated scanner ensuring every API route enforces authentication and permission policy. |
| **Total** | **232 tests** | **All 12 test files passing cleanly (0 failures, 0 warnings)** |

---

## 9. ENVIRONMENT VARIABLES & PRODUCTION SETUP

### Runtime Variables (Configured in Vercel Project Settings)

| Variable Name | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string (including database name) | `mongodb+srv://user:pass@cluster.mongodb.net/campusplace?retryWrites=true&w=majority` |
| `NEXTAUTH_URL` | Yes | Canonical deployment URL | `https://campusplace.vercel.app` |
| `NEXTAUTH_SECRET` | Yes | Cryptographic secret for signing session JWTs | `openssl rand -base64 32` |
| `STORAGE_PROVIDER` | Production: `s3` | Storage engine (`local` for dev/test only; `s3` for production / preview). Production fails safe if set to `local`. | `s3` |
| `S3_BUCKET_NAME` | When `s3` | Private bucket name for resumes and offer letters | `dypcet-campusplace-storage` |
| `S3_REGION` | When `s3` | AWS / Cloudflare R2 / MinIO region | `ap-south-1` (AWS) or `auto` (R2) |
| `S3_ACCESS_KEY_ID` | When `s3` | IAM Access Key ID scoped to PutObject, GetObject, DeleteObject | `AKIAIOSFODNN7EXAMPLE` |
| `S3_SECRET_ACCESS_KEY` | When `s3` | IAM Secret Access Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `S3_ENDPOINT` | Optional | Custom S3 endpoint (for Cloudflare R2, MinIO, or LocalStack) | `https://<account_id>.r2.cloudflarestorage.com` |

### Cloud Storage Security & Production Setup (AWS S3 / Cloudflare R2)

To ensure student privacy and institutional security:
1. **Private Bucket**: Create an S3 or R2 bucket (e.g. `dypcet-campusplace-prod`). Ensure "Block all public access" is **Enabled**. Under no circumstances should the bucket have public read ACLs or public bucket policies.
2. **Dedicated Buckets / Isolation**: Create separate buckets for Preview (`dypcet-campusplace-preview`) and Production (`dypcet-campusplace-prod`) environments. Configure environment variables in Vercel with appropriate environment scoping (`Preview` vs `Production`).
3. **Least-Privilege Scoped IAM User**:
   - Create an IAM User (e.g. `dypcet-campusplace-app`) with programmatic access only (access keys, no console access).
   - Attach an inline policy strictly granting object-level permissions to the specific bucket ARN:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "CampusPlaceBucketAccess",
           "Effect": "Allow",
           "Action": [
             "s3:PutObject",
             "s3:GetObject",
             "s3:DeleteObject",
             "s3:ListBucket"
           ],
           "Resource": [
             "arn:aws:s3:::dypcet-campusplace-prod",
             "arn:aws:s3:::dypcet-campusplace-prod/*"
           ]
         }
       ]
     }
     ```
4. **Vercel Ephemeral Disk Guard**:
   - Vercel serverless functions have ephemeral filesystems. Local disk uploads will be lost on container recycling.
   - The application enforces a hard fail-safe: if `STORAGE_PROVIDER=local` and `NODE_ENV=production` (or `VERCEL` is set), uploads return HTTP 500 with:
     `"Local storage is not supported in production. Configure STORAGE_PROVIDER=s3 with valid cloud credentials."`

### Bootstrap Variables (One-Time Seeder Only — NEVER in Vercel Runtime)

| Variable Name | Required | Description |
| :--- | :--- | :--- |
| `ADMIN_EMAIL` | Seed only | Email for initial Super Administrator bootstrap |
| `ADMIN_PASSWORD` | Seed only | Initial password for initial Super Administrator bootstrap |

> [!CAUTION]
> `ADMIN_PASSWORD` is **never read by application routes at runtime**. Logins authenticate exclusively against bcrypt hashes stored in MongoDB. Delete `ADMIN_PASSWORD` immediately after seeding.

---

## 10. STEP-BY-STEP DEPLOYMENT RUNBOOK

1. **MongoDB Atlas Cluster Setup**:
   - Create cluster on MongoDB Atlas.
   - Whitelist Vercel outbound IPs (`0.0.0.0/0` or Vercel Secure Compute).
   - Create database user with read/write access to `campusplace`.
2. **Configure Vercel Environment**:
   - Set `MONGODB_URI`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.
3. **Database Pre-Migration Safety Checks**:
   - Run dry-run to inspect department mapping:
     ```bash
     npm run migrate:departments:dry-run
     ```
   - Run interactive migration (confirms DB name and prompts operator):
     ```bash
     npm run migrate:departments
     ```
   - Run dry-run to inspect passout year backfill:
     ```bash
     npm run migrate:passout-year:dry-run
     ```
   - Run interactive passout year backfill:
     ```bash
     npm run migrate:passout-year
     ```
4. **Seed Initial Super Administrator**:
   - In local terminal, export seed variables:
     ```bash
     export MONGODB_URI="<atlas_connection_string>"
     export ADMIN_EMAIL="superadmin@dypcet.edu"
     export ADMIN_PASSWORD="<InitialPassword123!>"
     npm run seed:admin
     ```
5. **Verify Zero Secrets in Vercel**:
   - Ensure `ADMIN_PASSWORD` is NOT set in Vercel environment variables.
6. **Deploy & Validate**:
   - Trigger production deployment on Vercel.
   - Login at `/login` with seeded superadmin credentials.
   - Check system diagnostics at `/api/health` (accessible to `SUPER_ADMIN`).
   - Create staff accounts via `/admin/users`.

---

## 11. ROADMAP STATUS & REMAINING PHASES (PHASES 5 TO 8)

### Phase 3a: Student Management & Core Cohort Engine [CORE DELIVERED]
- **Batch Isolation**: Added `passoutYear` (cohort batch) to `Student` schema with index on `{ department: 1, passoutYear: 1 }` and `{ passoutYear: 1, placementStatus: 1 }`. Configured `currentAcademicYear` (`2025-2026`) and `defaultPassoutYear` (`2026`) in `collegeConfig.ts`. All student queries, dashboard aggregations, imports, and exports filter strictly by batch.
- **Strict Placement Status Governance**: Role-restricted to `TPO` and `SUPER_ADMIN`. De-listing a student from `Placed` status strictly requires a `statusChangeReason` and records an immutable audit log entry. `DEPT_COORDINATOR` and `STAFF` are prevented from altering placement status.
- **Resume Upload & Pluggable Storage**: Migrated to pluggable `StorageAdapter` with UUID keys, 2MB size limit, magic byte validation (`%PDF-`), and serving safely with `X-Content-Type-Options: nosniff`.
- **Bulk CSV Import with Duplicate PRN Detection**: `POST /api/students/import/preview` parses uploaded CSV and inspects for duplicates both within the uploaded file and against existing database records. `POST /api/students/import` validates strictly and inserts cohorts idempotently.
- **CSV Cohort Export**: `GET /api/students/export` streams sanitized CSV data with batch, department, and placement status filtering. Formula-safe escaping prevents CSV injection.
- **Student Management UI**: Student directory (`/students`) with batch switcher, search/filtering, placement update modal with mandatory de-listing reason, CSV import preview drawer with duplicate warnings, and CSV export.
- **Idempotent Migration Script**: `scripts/migrate-passout-year.ts` with `--dry-run` and interactive `--apply` modes, complete with unit test coverage.

### Phase 3b: Student Profile Extensions & Gap Follow-Up Backlog [PENDING BACKLOG]
> [!IMPORTANT]
> **Phase 3 is NOT described as complete.** While Phase 3a established core cohort tracking, batch isolation, and CSV import/export, the following comprehensive student profile extensions from the original Phase 3 specification are tracked as the Phase 3b follow-up backlog:
- **Phone Number Format & Emergency Contacts** (`Partial` in [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Basic optional phone string exists; E.164 phone regex validation, parent/guardian contact, and emergency contact details are deferred to Phase 3b.
- **Gender Field** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Not yet on student model. Company export presets strictly exclude gender until Phase 3b.
- **Date of Birth (DOB)** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Not yet on student model. Company export presets strictly exclude DOB until Phase 3b.
- **Division / Section Assignment** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Class division tagging (e.g. Division A, B) deferred to Phase 3b.
- **Semester-Wise SGPA Breakdown** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Cumulative `cgpa` is implemented; detailed 8-semester SGPA array and credit tracking are deferred to Phase 3b.
- **Historical Backlog Breakdown** (`Partial` in [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Active `backlogs` count is tracked; historical cleared backlog count and subject-wise backlog history are deferred to Phase 3b.
- **Technical Skills Inventory** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Tagged student technical competencies (languages, frameworks, cloud tools) deferred to Phase 3b.
- **Certifications & Credential Links** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Course certifications and external credential URLs deferred to Phase 3b.
- **Academic & Industry Projects** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Capstone projects, title, description, and repository links deferred to Phase 3b.
- **Prior Internships Experience** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Prior internship employer, role, duration, and stipend records deferred to Phase 3b.
- **Professional Social Profiles** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): GitHub, LinkedIn, and personal portfolio URLs deferred to Phase 3b.
- **Student Profile Picture Upload** (`Missing` from [src/models/Student.ts](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/models/Student.ts)): Student photo upload, avatar thumbnailing, and cloud storage deferred to Phase 3b.
- **Profile Completeness Meter** (`Missing` from [src/app/students/page.tsx](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/app/students/page.tsx)): Dynamic institutional profile completion percentage scoring (0–100%) deferred to Phase 3b.
- **Tabbed Student Profile View** (`Missing` from [src/app/students/page.tsx](file:///Users/pratikravan/Desktop/Placement%20Coordination%20Dashboard/src/app/students/page.tsx)): Tabbed profile modal or dedicated page (Academics, Experience, Documents, History) deferred to Phase 3b.

### Phase 4: Companies, Placement Drives, Eligibility Engine & Offer Workflow [COMPLETED]
- **Pluggable Cloud Storage Adapter**:
  - Implemented `StorageAdapter` interface with `LocalDiskStorageAdapter` (strictly for local dev/testing) and `S3CompatibleStorageAdapter` (AWS S3, Cloudflare R2, MinIO).
  - Selected dynamically via `STORAGE_PROVIDER`.
  - **Production Fail-Safe**: If `STORAGE_PROVIDER=local` in production or Vercel, file uploads are disabled with a clear message: `"Local storage is not supported in production. Configure STORAGE_PROVIDER=s3 with valid cloud credentials."`
  - 2MB strict file size limit on resumes and offer letters (complying with Vercel serverless request body bounds).
  - Magic-byte verification (`%PDF-`), serving strictly as `application/pdf` with `X-Content-Type-Options: nosniff` and safe `Content-Disposition`.
  - Random UUID storage keys (never derived from student ID or timestamp, never exposed to clients).
  - File deletion on replacement, and documented student deletion cleanup policy.
- **Institutional Models & Validation**:
  - `Company`: Sector, website, HR contacts (redacted for `DEPT_COORDINATOR`), notes, dynamic drive count, 409 deletion block if drives exist.
  - `Drive`: Type (`Full-time`, `Internship`, `Internship+PPO`), CTC/stipend, IST deadline enforcement, rounds pipeline, 409 deletion block if applications exist. Dynamic "Registration Closed" badge based on current IST time.
  - `Application`: Unique index on `{ drive: 1, student: 1 }` prevents concurrent double-registration. Current round index, round history, eligibility snapshot, and override audit trail (`overriddenBy`, `overrideReason`).
  - `Offer`: Role, CTC, stipend, tier (`Regular`, `Dream`, `Super Dream`), source (`On-Campus Drive`, `Off-Campus / Self-Placed`, `Pool Campus`), status (`Offered`, `Accepted`, `Declined`, `Revoked`), offer letter upload, and audit history.
  - `Student`: Added `tenthPercentage`, `twelfthOrDiplomaPercentage`, removed `default: 0` from `backlogs`. Zod preprocessors coerce blank string, `undefined`, or `null` to `null` before numeric parsing; `"0"` stays `0`.
- **Eligibility & Placement Policy Engine**:
  - `evaluateStudentEligibility()`: null CGPA, backlogs, or percentages yield explicit `"not recorded"` reason and ineligible status (never treated as 0 or passing). Empty allowed departments/batches mean "no restriction". Opted Out and Higher Studies students are ineligible.
  - Server-side IST registration deadline check (`isDriveRegistrationOpen()`).
  - `evaluatePlacementPolicyCompliance()`: enforces CTC tier progression rules and maximum accepted offer caps.
- **Two-Step Shortlist Workflow**:
  - `POST /api/drives/[id]/shortlist/preview`: previews matched, omitted, and unrecognized roll numbers without altering DB.
  - `POST /api/drives/[id]/shortlist/confirm`: idempotently advances matched candidates to the target round; optionally marks omitted candidates as `Rejected` with mandatory audit reason.
- **Offer Synchronization & Reversal Engine**:
  - `POST /api/offers`: synchronizes accepted qualifying offers (`Full-time`, `PPO`) with `Student.placementStatus = 'Placed'` and caches company name and package.
  - `PATCH /api/offers/[id]/reversal`: declining or revoking an offer re-evaluates all remaining offers for the student; if no other accepted offers remain, automatically reverts status to `'Not Placed'`.
- **Formula-Safe CSV Exports**:
  - `GET /api/drives/[id]/export`: escapes leading `=`, `+`, `-`, `@`, `\t`, `\r` with a single quote `'` to neutralize formula injection in Microsoft Excel / Google Sheets. Preset `company` strictly excludes DOB and gender until Phase 3b.
- **Server-Side Dashboard Package Analytics**:
  - `GET /api/dashboard-stats`: highest, average, and median package LPA computed server-side from distinct highest accepted qualifying offers.
  - Placement percentage formula: `(placedStudents / eligibleOptedInStudents) * 100`.
- **Audit & Migration Scripts**:
  - `scripts/report-incomplete-students.ts`: flags missing academic criteria and detects `backlogs === 0` with unrecorded CGPA as possible default-0 artifacts.
  - `scripts/backfill-manual-offers.ts`: dry-run by default; `--apply` prints target DB host/name and requires typing the DB name to confirm; lists all conversion assumptions.
- **Full UI Integration**:
  - Companies Directory (`/companies`) with create/edit modal and HR contact management.
  - Placement Drives Directory (`/drives`) with batch switcher, status filter, and creation modal.
  - Drive Detail & Pipeline Dashboard (`/drives/[id]`) with Overview, Eligibility Roster, Applicant Pipeline with Shortlist Modal, and Drive Offers.
  - Institutional Offers Directory (`/offers`) with manual off-campus offer creation, offer letter PDF upload, and offer reversal modal.
  - Sidebar updated with direct navigation links.

### Phase 5: Attendance & Real-Time Tracking
- QR-code generated attendance check-in for physical training sessions.
- Student self-scan with geotag / session-token validation.
- Absentee alerts to department faculty coordinators.
- Exportable attendance percentage reports for examination clearance.

### Phase 6: Student Portal & Self-Service
- Authenticated student dashboard (login via PRN / university roll number).
- Application submission for active campus drives.
- Personal attendance records, training schedules, and feedback submission.
- Digital profile update & verified resume upload.

### Phase 7: Analytics, Reports & Accreditation
- NAAC / NIRF accreditation data exporter (Criterion 5.2 placement tables).
- Department-wise placement percentage comparisons and year-over-year trends.
- Highest, average, and median package calculations.
- Top hiring partners and recruiter satisfaction indexing.

### Phase 8: Hardening, Security Audit & Final Production Polish
- Role-based rate limiting on sensitive administrative actions.
- Automated database backup integration (AWS S3 / Atlas snapshots).
- Performance indexing and query profiling for cohorts exceeding 10,000 students.
- Full accessibility compliance audit (WCAG 2.1 AA).
