# DYPCET CampusPlace – Training & Placement Cell Portal

Production-grade Training & Placement (T&P) Management System for **D.Y. Patil College of Engineering & Technology (DYPCET), Kasaba Bawada, Kolhapur, Maharashtra**.

---

## Features (Phase 1 Foundation)

- **Role-Based Access Control (RBAC)**: Support for `SUPER_ADMIN`, `TPO` (Training & Placement Officer), `DEPT_COORDINATOR`, and `STUDENT`.
- **Secure Authentication**: Bcrypt-hashed password storage, JWT sessions via NextAuth, and rate-limited login endpoints.
- **Audit Logging**: Comprehensive tracking of authentication events and CRUD operations with actor, role, IP, and timestamp.
- **Configurable College Settings**: Centralized configuration (`src/config/collegeConfig.ts`) with placeholders for departments, contact info, and branding.
- **Safe Bootstrap Seeder**: Idempotent administrative seeder (`npm run seed:admin`) that safely provisions initial access without wiping data.
- **Serverless-Optimized Database**: Mongoose connection caching with fast failure discovery (`serverSelectionTimeoutMS: 5000`) for Vercel.
- **Validated APIs**: Strict request validation using Zod with server-side pagination, search, and filtering.

---

## Environment Variables

### Production Runtime Variables (Required on Vercel)
These variables MUST be configured in your Vercel Project Settings:

| Variable | Description |
| :--- | :--- |
| `MONGODB_URI` | MongoDB Atlas connection string (include database name, ensure `0.0.0.0/0` or Vercel egress IP whitelist) |
| `NEXTAUTH_URL` | Canonical deployment URL (e.g. `https://campusplace.vercel.app` or custom domain) |
| `NEXTAUTH_SECRET` | 32+ character cryptographic secret for signing session JWTs (`openssl rand -base64 32`) |

### One-Time Bootstrap Variables (Seed Only — NEVER Keep in Runtime)
| Variable | Description |
| :--- | :--- |
| `ADMIN_EMAIL` | Super Admin email address used solely by `npm run seed:admin` |
| `ADMIN_PASSWORD` | Super Admin initial password used solely by `npm run seed:admin` |

> [!IMPORTANT]
> `ADMIN_PASSWORD` is **never used by the application at runtime**. All logins verify against bcrypt hashes stored in MongoDB. Once seeded, `ADMIN_PASSWORD` must be deleted from Vercel to maintain zero-trust security.

---

## Production Setup & Deployment Steps (In Order)

Follow this exact sequence to deploy CampusPlace to production:

### 1. Database Provisioning (MongoDB Atlas)
1. Create a MongoDB Atlas cluster (M0 or higher).
2. Create a database user with read/write permissions to the `campusplace` database.
3. In **Network Access**, whitelist all IP addresses (`0.0.0.0/0`) or configure Vercel Secure Compute integration.
4. Copy the connection string (`mongodb+srv://<user>:<password>@cluster.mongodb.net/campusplace?retryWrites=true&w=majority`).

### 2. Configure Vercel Project Environment Variables
In your Vercel Project Settings (**Settings → Environment Variables**), set:
- `MONGODB_URI` = Your MongoDB connection string
- `NEXTAUTH_URL` = Your production URL (e.g., `https://campusplace.vercel.app`)
- `NEXTAUTH_SECRET` = A generated random secret (`openssl rand -base64 32`)

*(Do NOT add `ADMIN_PASSWORD` here yet).*

### 3. Run Department Identity Migration (With Pre-Migration Safety Checks)
If migrating legacy data with free-text department names:
- **Affected Collections**: `students` (normalizes `department` and retains legacy `branch`), `users` (normalizes coordinator `department`).
- **Safety Precondition**: Take a full backup using `mongodump` before applying changes:
  ```bash
  mongodump --uri="<MONGODB_URI>" --out="./backup-$(date +%F)"
  ```

1. **Dry-Run (Default - Read Only)**:
   Inspect target host, DB name, and review mapped vs unmapped counts without modifying data:
   ```bash
   npm run migrate:departments:dry-run
   ```

2. **Apply Changes (Interactive Safety Confirmation)**:
   The script prints the target host and database name, reminds you to back up, and **requires you to type the database name** to confirm before applying changes:
   ```bash
   npm run migrate:departments
   ```
   *(For automated CI pipelines, non-interactive execution can be confirmed with `--confirm-db=<database_name>`)*.

### 4. Seed the Super Administrator
1. In your local terminal or a secure deployment task, export the temporary seed variables:
   ```bash
   export MONGODB_URI="<your-mongodb-atlas-connection-string>"
   export ADMIN_EMAIL="superadmin@dypcet.edu"
   export ADMIN_PASSWORD="<YourSecureInitialPassword1!>"
   ```
2. Run the idempotent administrative seeder:
   ```bash
   npm run seed:admin
   ```
   *Note: If an administrator already exists with this email, the seeder safely exits without overwriting.*

### 5. Remove Seed Credentials from Vercel (Critical Security Step)
Verify that **neither** `ADMIN_PASSWORD` nor `ADMIN_EMAIL` are saved in Vercel's Environment Variables. If you temporarily set them in Vercel for seeding, delete them immediately.

### 6. Verify Deployment & Health Check
1. Deploy the project to Vercel.
2. Sign in with your provisioned Super Admin credentials at `/login`.
3. Verify system health at `/api/health` (only accessible to `SUPER_ADMIN`).
4. Navigate to `/admin/users` to provision staff accounts (TPO and Department Coordinators). Every newly provisioned account receives a temporary password shown once and is forced to set a strong permanent password upon first login.

---

## Development & Testing

```bash
# Run unit & route-level authorization tests
npm test

# Run ESLint validation
npm run lint

# Run Next.js production build
npm run build
```
