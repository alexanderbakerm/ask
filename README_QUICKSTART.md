# Quickstart Guide

Get your SaaS up and running in under 10 minutes.

## Prerequisites

Before starting, ensure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)
- **PostgreSQL** - Either:
  - [Docker](https://www.docker.com/products/docker-desktop) (recommended) or
  - [Local PostgreSQL](https://www.postgresql.org/download/)

## Step 1: Clone & Install

```bash
# Clone the repository
git clone <repo-url> my-saas
cd my-saas

# Install dependencies
npm install
```

## Step 2: Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

### Minimum Required Variables

Open `.env` and set these required values:

```bash
# Generate a secret: npx @better-auth/cli secret
BETTER_AUTH_SECRET="your-32-character-secret-here"

# Database (uses Docker defaults)
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="password"
POSTGRES_DB="database"
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
DATABASE_URL="postgresql://postgres:password@localhost:5432/database"

# Site URL
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

> **Tip:** Generate a secure auth secret with:
>
> ```bash
> npx @better-auth/cli secret
> # or
> openssl rand -base64 32
> ```

## Step 3: Start the Database

**Option A: Using Docker (recommended)**

```bash
npm run docker:up
npm run db:migrate
```

**Option B: Using local PostgreSQL**

1. Create a database:

```bash
createdb database
# Or via psql:
psql -c "CREATE DATABASE database;"
```

2. Update `DATABASE_URL` in `.env` to match your local setup:

```bash
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/database"
```

3. Run migrations:

```bash
npm run db:migrate
```

## Step 4: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) - your app is running!

## Step 5: Create Your First Account

1. Go to [http://localhost:3000/auth/sign-up](http://localhost:3000/auth/sign-up)
2. Enter your name, email and password
3. Since email is not configured yet, check the console for the verification link
4. Click the link to verify your email
5. You're in!

## Step 6: Make Yourself an Admin

The first user should be a platform admin to access the admin dashboard (`/dashboard/admin`).

**Option A: Using Drizzle Studio (Recommended)**

```bash
# Open Drizzle Studio
npm run db:studio
```

1. Open [https://local.drizzle.studio](https://local.drizzle.studio) in your browser
2. Click on the `user` table
3. Find your user and click to edit
4. Change `role` from `user` to `admin`
5. Save

**Option B: Using SQL directly**

```bash
# If using Docker:
docker exec -it template-drizzle-db-1 psql -U postgres -d database

# If using local PostgreSQL:
psql -d database

# Then run:
UPDATE "user" SET role = 'admin' WHERE email = 'your@email.com';
\q
```

Now you can access the admin panel at [http://localhost:3000/dashboard/admin](http://localhost:3000/dashboard/admin) to:

- Manage all users (ban/unban, view details)
- Manage all organizations
- Access system-wide settings

---

## Optional Features Setup

The app works with just the basics above. Enable additional features as needed:

### Email (Recommended)

Enables: Email verification, password reset, invitations

```bash
# Sign up at https://resend.com
RESEND_API_KEY="re_xxxxx"
EMAIL_FROM="noreply@yourdomain.com"
# Note: Contact email is configured in config/app.config.ts
```

### Google OAuth

Enables: "Sign in with Google"

```bash
# Create credentials at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxx"
```

**Redirect URI:** `http://localhost:3000/api/auth/callback/google`

### Stripe Billing

Enables: Subscriptions, one-time payments, customer portal

```bash
# Get keys from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY="sk_test_xxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"

# Create products in Stripe Dashboard, then add Price IDs
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY="price_xxxxx"
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY="price_xxxxx"
NEXT_PUBLIC_STRIPE_PRICE_LIFETIME="price_xxxxx"
```

**Local webhook testing:**

```bash
npm run stripe:listen
```

### AI Chat

Enables: Organization chatbot feature

```bash
# Get key from https://platform.openai.com/api-keys
OPENAI_API_KEY="sk-xxxxx"
```

### File Storage (Cloudflare R2)

Enables: Avatar uploads, file attachments

```bash
# Set up at https://dash.cloudflare.com → R2 Object Storage
S3_ACCESS_KEY_ID="xxxxx"
S3_SECRET_ACCESS_KEY="xxxxx"
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_REGION="auto"
NEXT_PUBLIC_IMAGES_BUCKET_NAME="my-app-images"
```

### Error Monitoring (Sentry)

Enables: Error tracking, performance monitoring

```bash
# Set up at https://sentry.io
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="sntrys_xxxxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx.ingest.sentry.io/xxxxx"
```

### Bot Protection (Turnstile)

Enables: Captcha on auth forms

```bash
# Set up at https://dash.cloudflare.com → Turnstile
TURNSTILE_SECRET_KEY="0x4xxxxx"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4xxxxx"
```

---

## Common Commands

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `npm run dev`           | Start development server        |
| `npm run build`         | Build for production            |
| `npm run start`         | Start production server         |
| `npm run db:migrate`    | Run database migrations         |
| `npm run db:studio`     | Open Drizzle Studio (DB GUI)    |
| `npm run db:generate`   | Generate new migration          |
| `npm run docker:up`     | Start PostgreSQL                |
| `npm run docker:down`   | Stop PostgreSQL                 |
| `npm run stripe:listen` | Forward Stripe webhooks locally |
| `npm run email:dev`     | Preview email templates         |
| `npm run test`          | Run unit tests                  |
| `npm run e2e`           | Run E2E tests                   |
| `npm run lint`          | Run linter                      |
| `npm run check:write`   | Fix lint/format issues          |
| `npm run deps:check`    | Check for dependency updates    |
| `npm run deps:update`   | Update package.json versions    |

---

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── (marketing)/        # Public marketing pages
│   ├── (saas)/             # Protected SaaS app
│   │   ├── auth/           # Sign in/up pages
│   │   └── dashboard/      # Main dashboard
│   └── api/                # API routes
├── components/             # React components
│   ├── ui/                 # Reusable UI primitives
│   └── ...                 # Feature components
├── config/                 # App configuration
├── content/                # MDX content (blog, docs, legal)
├── lib/                    # Core libraries
│   ├── auth/               # Authentication
│   ├── billing/            # Stripe billing
│   ├── db/                 # Database & schema
│   └── email/              # Email templates
├── trpc/                   # tRPC API layer
└── types/                  # TypeScript types
```

---

## Key Configuration Files

### `config/app.config.ts`

App name, description, contact info.

### `config/billing.config.ts`

Plans, pricing, features, limits.

### `config/auth.config.ts`

Session duration, password rules, redirects.

### `lib/db/schema/tables.ts`

Database tables and columns.

---

## Making It Your Own

### 1. Update Branding

Edit `config/app.config.ts`:

```typescript
export const appConfig = {
  appName: "Your App Name",
  description: "Your app description",
  contact: {
    phone: "(123) 456-7890",
    address: "Your Address",
  },
};
```

### 2. Update Plans

Edit `config/billing.config.ts` to customize:

- Plan names and descriptions
- Features list
- Pricing
- Limits (members, storage)

### 3. Update Content

- Edit `content/posts/` for blog posts
- Edit `content/docs/` for documentation
- Edit `content/legal/` for privacy/terms

### 4. Update Styling

- Colors: Edit CSS variables in `app/globals.css`
- Components: Modify files in `components/ui/`
- Tailwind: Configure in `tailwind.config.ts`

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy!

**Required env vars for production:**

- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- `NEXT_PUBLIC_SITE_URL`

### Database Providers

- [Neon](https://neon.tech) - Best for serverless
- [Supabase](https://supabase.com) - Full platform
- [Railway](https://railway.app) - Simple setup

---

## Troubleshooting

### Database connection failed

```bash
# Check Docker is running
docker ps

# Restart the database
npm run docker:down
npm run docker:up
```

### Migration failed

```bash
# Reset and re-run migrations
npm run db:push
```

### Build errors

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Environment validation errors

```bash
# Skip validation temporarily
SKIP_ENV_VALIDATION=true npm run build
```

---

## Resources

- [Better Auth Docs](https://www.better-auth.com/docs) - Authentication
- [Drizzle Docs](https://orm.drizzle.team/docs) - Database ORM
- [tRPC Docs](https://trpc.io/docs) - API layer
- [Stripe Docs](https://docs.stripe.com) - Billing
- [Tailwind Docs](https://tailwindcss.com/docs) - Styling
