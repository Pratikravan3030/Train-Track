# CampusPlace Production Go-Live Runbook (`GO_LIVE.md`)

**Target System**: D.Y. Patil College of Engineering & Technology (DYPCET), Kasaba Bawada, Kolhapur  
**Original State**: Database `traintrack` on MongoDB Atlas with 4 collections (`students`, `trainingsessions`, `attendances`, `feedbacks`), no `users` collection, no student portal.  
**Target State**: Production CampusPlace with normalized department codes, batch cohort isolation, role-based access control, audit logging, formula-safe reporting, and optional student portal.

---

## Pre-Flight Checklist & Safety Boundaries
> [!CAUTION]
> Never run migrations or seeding without an export backup. Verify environment variables before executing any step.

---

## 1. Export Pre-Migration Database Backup
Run the read-only JSON backup export to snapshot all legacy collections (`students`, `trainingsessions`, `attendances`, `feedbacks`) prior to schema index updates or migrations:

```bash
# Set your production database URI in a private terminal session (do not commit)
export MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/traintrack"

# Run read-only export (creates timestamped, redacted JSON files in gitignored ./backups)
npm run export:backup
```

Verify that `./backups/traintrack_backup_<timestamp>/` contains:
- `students.json`
- `trainingsessions.json`
- `attendances.json`
- `feedbacks.json`

---

## 2. Vercel Environment Configuration
Configure separate environment variables in Vercel for **Production** and **Preview** to prevent staging builds from altering production data.

| Variable Name | Environment | Value / Specification |
| :--- | :--- | :--- |
| `MONGODB_URI` | **Production** | Must point to production cluster and end with `/traintrack` |
| `MONGODB_URI` | **Preview** | Must point to an isolated preview DB ending in `_preview` or `_dev` |
| `NEXTAUTH_SECRET` | Production & Preview | 32+ character random secret (generated via `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Production | `https://campusplace.dypcet.ac.in` (or production Vercel domain) |
| `NEXTAUTH_URL` | Preview | Auto-configured or preview deployment URL |
| `ADMIN_EMAIL` | Production | Primary Super Administrator email (e.g. `admin@dypcet.ac.in`) |
| `ADMIN_PASSWORD` | Production | Temporary strong setup password (must be rotated on first login) |
| `STUDENT_PORTAL_ENABLED` | **Production** | Set to `false` initially during staff rollout; toggle to `true` when ready |
| `S3_ENDPOINT` | Optional | Object storage endpoint (Cloudflare R2, AWS S3, or MinIO) |
| `S3_REGION` | Optional | Storage region (e.g. `ap-south-1` or `auto`) |
| `S3_BUCKET_NAME` | Optional | Bucket for resumes, photos, and offer letters |
| `S3_ACCESS_KEY_ID` | Optional | Least-privilege IAM access key |
| `S3_SECRET_ACCESS_KEY` | Optional | Least-privilege IAM secret key |

---

## 3. Duplicate Feedback Pre-Index Check & Remediation
CampusPlace enforces a compound unique index on `{ sessionId: 1, studentId: 1 }` for non-null `studentId`. If legacy feedback submissions contain duplicates for any student in the same session, index creation will fail with code `11000`.

Run the following MongoDB aggregation shell query against `traintrack` to verify:

```javascript
// mongosh query on traintrack
db.feedbacks.aggregate([
  { $match: { studentId: { $ne: null } } },
  { $group: {
      _id: { sessionId: "$sessionId", studentId: "$studentId" },
      count: { $sum: 1 },
      ids: { $push: "$_id" }
    }
  },
  { $match: { count: { $gt: 1 } } }
]);
```

- If 0 duplicates return: proceed immediately.
- If duplicates are detected: remove the older duplicates keeping the latest feedback document (`_id: { $max: "$ids" }`).

---

## 4. Canonical Department Migration
Legacy documents contain variable department strings (e.g. `"Mechanical"`, `"mech"`, `"Comp Sci"`, `"CSE"`). The migration script normalizes these into canonical enum codes (`CSE`, `IT`, `ECE`, `EE`, `ME`, `CE`, `OTHER`).

### Step 4a: Dry-Run (Zero Modifications)
```bash
npm run migrate:departments:dry-run
```
Inspect the console report. Verify that:
- Total matching students and departments are recognized.
- Ambiguous strings map to `OTHER` or expected canonical codes.
- No documents were modified.

### Step 4b: Apply Department Migration
```bash
npm run migrate:departments
```
Type `CONFIRM` when prompted. The script sets `department: "<CODE>"`, preserves the legacy raw string in `branch` for backwards compatibility, and completes.

---

## 5. Passout Year Migration Verification
Ensure all legacy students have an assigned `passoutYear`. Run:

```bash
# Check if any student lacks passoutYear
mongosh "$MONGODB_URI" --eval 'db.students.countDocuments({ passoutYear: { $exists: false } })'
```

If count > 0, backfill with the institutional default (2026):
```javascript
db.students.updateMany(
  { passoutYear: { $exists: false } },
  { $set: { passoutYear: 2026 } }
);
```

---

## 6. Bootstrap Initial Super Administrator (`seed:admin`)
Bootstrap the initial administrative user into the new `users` collection:

```bash
npm run seed:admin
```
This creates the initial `SUPER_ADMIN` account using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your environment.
The user will be created with `mustChangePassword: true`, requiring an immediate password change upon first login.

---

## 7. Storage Setup (Least-Privilege Buckets & Keys)
If using cloud object storage (AWS S3 or Cloudflare R2) instead of the default local disk adapter:

1. **Bucket Architecture**:
   - Bucket: `dypcet-campusplace-documents` (private, block public access enabled)
   - Prefix `/resumes/`: Student resume PDFs (max 2MB, PDF only)
   - Prefix `/photos/`: Student profile pictures (max 2MB, JPEG/PNG/WebP only)
   - Prefix `/offer-letters/`: Sensitive offer letters (restricted to TPO and owning student)
2. **Least-Privilege IAM Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject"
         ],
         "Resource": "arn:aws:s3:::dypcet-campusplace-documents/*"
       }
     ]
   }
   ```
3. Set the `S3_*` environment variables in Vercel. If storage variables are omitted, file uploads gracefully disable with clear administrator notices while the rest of the application remains fully functional.

---

## 8. Create Initial TPO & Coordinator Accounts
1. Log in to `/login` using the Super Admin credentials.
2. Complete the forced password change when prompted.
3. Navigate to **User Accounts** (`/admin/users`) in the navigation sidebar.
4. Click **Create User**:
   - Create the Training & Placement Officer account (Role: `TPO`).
   - Create Department Coordinators for each active department (Role: `DEPT_COORDINATOR`, select department: `CSE`, `IT`, `ECE`, `EE`, `ME`, `CE`).
5. Share temporary credentials with staff; their accounts will prompt them for password change on first sign-in.

---

## 9. Staged Student Portal Rollout
1. **Initial Deployment**: Keep `STUDENT_PORTAL_ENABLED=false` in Vercel production settings.
   - All student API routes return `403 Forbidden`.
   - Any student trying to log in is greeted with an informative "Student portal is currently disabled" state.
   - Staff can safely audit data, create drives, and verify rosters.
2. **Launch Day**:
   - In Vercel Project Settings > Environment Variables, update `STUDENT_PORTAL_ENABLED` to `true`.
   - Redeploy or promote deployment.
   - Students can now log in, view eligible drives, check in to training sessions, submit single feedback, and update their enrichment profile.

---

## 10. Rollback Strategy & Legacy Code Readability
If an unexpected emergency requires rolling back to the original deployed code via Vercel:

1. In Vercel Deployments, click on the last known stable deployment of the original application and select **Promote to Production**.
2. **Compatibility of Migrated Data with Old Code**:
   - **What old code CAN read**:
     - `students`: Old code reads `name`, `rollNumber`, and `branch`. Because migration preserved the raw branch string in `branch` while adding `department`, legacy queries and pages continue to render.
     - `trainingsessions`: Old code reads `title`, `trainer`, `date`, `description`. All new fields (`category`, `targetDepartments`, `venue`) are additive and ignored by old code.
     - `attendances`: Old code reads `sessionId`, `studentId`, `present`. The new `status` and `remarks` fields are additive and do not break old queries.
     - `feedbacks`: Old code reads `sessionId`, `rating`, `comment`. The new `studentId` and `source` fields are additive.
   - **What old code CANNOT read / will ignore**:
     - `companies`, `drives`, `applications`, `offers`, `assessments`, `notices`, `notifications`, `auditlogs`, and `users` are completely ignored by old code without error.
3. No destructive dropping of collections occurs at any point.

---

## 11. Unverified Institutional Placeholders in `collegeConfig.ts`
The following configuration placeholders in `src/config/collegeConfig.ts` are marked with `[UNVERIFIED: ...]` and must be replaced with official DYPCET details before final production sign-off:

| Config Path | Current Placeholder Value | Required Institution Confirmation |
| :--- | :--- | :--- |
| `COLLEGE_CONFIG.institution.contactEmail` | `[UNVERIFIED: info@dypcet.ac.in]` | Official college registrar contact email |
| `COLLEGE_CONFIG.institution.contactPhone` | `[UNVERIFIED: +91 231 2601431]` | Main administrative PBX phone number |
| `COLLEGE_CONFIG.institution.website` | `[UNVERIFIED: https://coek.dypgroup.edu.in]` | Official institutional web domain |
| `COLLEGE_CONFIG.institution.logoUrl` | `[UNVERIFIED: /images/dypcet-logo.png]` | Official crest / logo vector asset |
| `COLLEGE_CONFIG.tpCell.email` | `[UNVERIFIED: tpo@dypcet.ac.in]` | Dedicated Training & Placement Cell inbox |
| `COLLEGE_CONFIG.tpCell.contactPerson` | `[UNVERIFIED: Training & Placement Officer]` | Official designation and name of Head TPO |
| `COLLEGE_CONFIG.academic.departments` | Engineering departments (`CSE`, `IT`, `ECE`, `EE`, `ME`, `CE`, `OTHER`) | Confirm department codes match DYPCET academic catalog |
| `PLACEMENT_POLICY_CONFIG.tiers` | Regular (< 5 LPA), Dream (5-10 LPA), Super Dream (10+ LPA) | Confirm salary tier cutoffs with T&P Committee |
| `PLACEMENT_POLICY_CONFIG.rules` | One offer policy, tier upgrade only, max 2 offers | Confirm institutional placement policy rules |
| `PLACEMENT_POLICY_CONFIG.placementPercentageCalculation.denominatorBasis` | `'eligibleOptedIn'` | Confirm whether college reports % over eligible/opted-in or total cohort |
