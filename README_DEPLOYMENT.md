# Deployment Guide

Deploy your SaaS to production on Vercel with a PostgreSQL database.

---

## Quick Deploy (5 Minutes)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### 2. Create PostgreSQL Database

Choose a serverless PostgreSQL provider:

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| [Neon](https://neon.tech) | 0.5 GB, auto-suspend | Serverless, branching |
| [Supabase](https://supabase.com) | 500 MB, 2 projects | Full platform |
| [Railway](https://railway.app) | $5 credit/month | Simple setup |
| [PlanetScale](https://planetscale.com) | $5/month | Most reliable |
| [Vercel Postgres](https://vercel.com/storage/postgres) | Via marketplace | Native integration |

**Get your connection string** (looks like):
```
postgresql://user:password@host:5432/database?sslmode=require
```

### 3. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Add environment variables (minimum required):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Generate with `npx @better-auth/cli secret` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` (or leave empty for auto-detect) |

4. Click **Deploy**

That's it! Your app is live.

---

## Environment Variables

### Required (Minimum)

| Variable | Description | How to Get |
|----------|-------------|------------|
| `DATABASE_URL` | PostgreSQL connection string | From your database provider |
| `BETTER_AUTH_SECRET` | 32+ character secret | `npx @better-auth/cli secret` |

> **Note**: `NEXT_PUBLIC_SITE_URL` is auto-detected on Vercel. Only set it if you have a custom domain.

### Recommended for Production

#### Email (Resend)

Required for: Email verification, password reset, invitations

```bash
EMAIL_FROM="noreply@yourdomain.com"
RESEND_API_KEY="re_xxxxx"
```

> **Note**: Contact email is configured in `config/app.config.ts`

**Setup**:
1. Create account at [resend.com](https://resend.com)
2. Add and verify your domain
3. Create API key with sending access

#### Error Monitoring (Sentry)

Required for: Error tracking, performance monitoring

```bash
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="sntrys_xxxxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx.ingest.sentry.io/xxxxx"
```

**Setup**:
1. Create account at [sentry.io](https://sentry.io)
2. Create Next.js project
3. Get DSN from project settings
4. Create auth token with `project:read`, `project:releases`, `org:read` scopes

### Optional Features

#### Google OAuth

```bash
GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxx"
```

**Setup**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `https://yourdomain.com/api/auth/callback/google`

#### Stripe Billing

```bash
STRIPE_SECRET_KEY="sk_live_xxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY="price_xxxxx"
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY="price_xxxxx"
```

**Setup**:
1. Get keys from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Create webhook endpoint (see [Webhook Setup](#stripe-webhook-setup))

#### File Storage (Cloudflare R2)

```bash
S3_ACCESS_KEY_ID="xxxxx"
S3_SECRET_ACCESS_KEY="xxxxx"
S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
S3_REGION="auto"
NEXT_PUBLIC_IMAGES_BUCKET_NAME="your-bucket"
```

**Setup**:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 Object Storage
2. Create a bucket
3. Create R2 API token with Object Read & Write permissions
4. Configure CORS for your domain

#### Bot Protection (Turnstile)

```bash
TURNSTILE_SECRET_KEY="0x4xxxxx"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4xxxxx"
```

#### AI Chatbot

```bash
OPENAI_API_KEY="sk-xxxxx"
```

---

## Database Setup

### Neon (Recommended)

1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection string from dashboard
4. Add `?sslmode=require` if not included

```bash
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

**Features**: Auto-suspend (saves costs), database branching, instant provisioning

### Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings → Database
3. Copy URI from "Connection string"

```bash
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

### Railway

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy PostgreSQL
3. Click on PostgreSQL service → Variables tab
4. Copy `DATABASE_URL`

### PlanetScale

1. Create account at [planetscale.com](https://planetscale.com)
2. Create new database, select **Postgres** as the engine
3. Copy connection string from dashboard

```bash
DATABASE_URL="postgresql://user:pass@[region].connect.psdb.cloud/your-database?sslmode=require"
```

**Features**: Horizontal scaling, online schema changes, branching, high availability

### Vercel Postgres (via Marketplace)

1. In Vercel Dashboard → Storage → Browse Storage → Postgres
2. Create database
3. Connect to your project
4. `DATABASE_URL` is auto-added to your project

---

## Stripe Webhook Setup

### 1. Create Webhook Endpoint

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `customer.subscription.trial_will_end`
   - `customer.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
   - `payment_intent.succeeded`

### 2. Copy Signing Secret

1. Click on the created webhook
2. Copy "Signing secret" (starts with `whsec_`)
3. Add to Vercel as `STRIPE_WEBHOOK_SECRET`

### 3. Create Products & Prices

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Create product (e.g., "Pro Plan")
3. Add prices (monthly, yearly)
4. Copy Price IDs (starts with `price_`)
5. Add to Vercel as `NEXT_PUBLIC_STRIPE_PRICE_*`

---

## Custom Domain

### 1. Add Domain in Vercel

1. Go to Project Settings → Domains
2. Add your domain (e.g., `app.yourdomain.com`)
3. Follow DNS instructions

### 2. Update Environment Variables

```bash
NEXT_PUBLIC_SITE_URL="https://app.yourdomain.com"
```

### 3. Update OAuth Redirect URIs

If using Google OAuth:
- Add `https://app.yourdomain.com/api/auth/callback/google` to authorized redirect URIs

### 4. Update Stripe Webhook

- Create new webhook endpoint with production domain
- Or update existing endpoint URL

---

## Build Configuration

### How It Works

The app uses a custom build script (`vercel.sh`):

```bash
#!/bin/bash
if [[ $VERCEL_ENV == "production" || $VERCEL_GIT_COMMIT_REF == "staging" ]] ; then 
  npm run deploy    # build + db:migrate
else 
  npm run build     # build only (preview deployments)
fi
```

- **Production/Staging**: Runs migrations automatically
- **Preview deployments**: Build only (no migrations)

### Migration Safety

Migrations only run on:
- Production deployments (`VERCEL_ENV == "production"`)
- Staging branch deployments (`VERCEL_GIT_COMMIT_REF == "staging"`)

Preview deployments (PRs) share the same database but don't run migrations.

---

## Monitoring & Analytics

### Vercel Analytics

1. Go to Project → Analytics tab
2. Click "Enable"

### Vercel Speed Insights

1. Go to Project → Speed Insights tab
2. Click "Enable"

### Sentry (Error Tracking)

Already configured in the app. Just add environment variables:

```bash
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="sntrys_xxxxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx.ingest.sentry.io/xxxxx"
```

Sentry is only enabled in production (`VERCEL_ENV === "production"`).

---

## Environment-Specific Deployments

### Production

- Branch: `main`
- Runs migrations: Yes
- Sentry: Enabled
- URL: Your custom domain or `your-app.vercel.app`

### Staging

- Branch: `staging`
- Runs migrations: Yes
- Sentry: Disabled (unless configured)
- URL: `your-app-staging.vercel.app`

**Tip**: Use a separate database for staging to avoid conflicts.

### Preview

- Branch: Any PR
- Runs migrations: No
- Sentry: Disabled
- URL: Auto-generated (`your-app-xxx-your-team.vercel.app`)

---

## Troubleshooting

### Build Fails: Environment Validation

**Error**: `Environment variable X is required`

**Solution**: Add the missing variable in Vercel Dashboard → Settings → Environment Variables

**Temporary workaround** (not recommended):
```bash
SKIP_ENV_VALIDATION=true
```

### Build Fails: Database Connection

**Error**: `Connection refused` or `ENOTFOUND`

**Solutions**:
1. Check `DATABASE_URL` is correct
2. Ensure SSL mode is included: `?sslmode=require`
3. Check database allows connections from Vercel IPs

### Migrations Fail

**Error**: Migration errors during deployment

**Solutions**:
1. Test migrations locally first: `npm run db:migrate`
2. Check migration files in `lib/db/migrations/`
3. Verify database user has CREATE/ALTER permissions

### Webhook Signature Verification Failed

**Error**: `Webhook signature verification failed`

**Solutions**:
1. Use the correct signing secret (from Stripe Dashboard → Webhooks → your endpoint)
2. For local dev, use `npm run stripe:listen` and its generated secret
3. Ensure webhook URL matches exactly (including https://)

### CORS Errors on File Upload

**Error**: CORS policy blocked

**Solution**: Configure CORS on your S3/R2 bucket:
```json
{
  "AllowedOrigins": ["https://yourdomain.com"],
  "AllowedMethods": ["GET", "PUT", "DELETE"],
  "AllowedHeaders": ["*"]
}
```

---

## Security Checklist

- [ ] Generate unique `BETTER_AUTH_SECRET` (don't reuse from development)
- [ ] Use Stripe live keys (not test keys) for production
- [ ] Enable Sentry for error monitoring
- [ ] Set up email for transactional notifications
- [ ] Configure CORS properly for file storage
- [ ] Add custom domain with HTTPS
- [ ] Set up Turnstile for bot protection (optional)

---

## Cost Optimization

### Database

- **Neon**: Auto-suspends after inactivity (free tier friendly)
- **Supabase**: Pauses after 1 week inactivity on free tier
- **Railway**: $5 free credit, then usage-based

### Vercel

- **Hobby (Free)**: 100GB bandwidth, 100 hours serverless
- **Pro ($20/mo)**: Unlimited bandwidth, team features

### Stripe

- 2.9% + $0.30 per transaction
- No monthly fees

### File Storage (R2)

- Free: 10GB storage, 10M reads/month
- Very cheap beyond free tier

---

## Deployment Checklist

### Before First Deploy

- [ ] Push code to GitHub
- [ ] Create PostgreSQL database
- [ ] Generate `BETTER_AUTH_SECRET`
- [ ] Add minimum environment variables to Vercel

### After First Deploy

- [ ] Verify app loads correctly
- [ ] Create test account
- [ ] Make yourself admin (via database)
- [ ] Test authentication flow

### Production Ready

- [ ] Add custom domain
- [ ] Configure email (Resend)
- [ ] Set up Stripe (if using billing)
- [ ] Enable Sentry monitoring
- [ ] Enable Vercel Analytics
- [ ] Set up file storage (if needed)
- [ ] Update OAuth redirect URIs

---

## Quick Reference

### Vercel CLI Commands

```bash
# Install Vercel CLI
npm i -g vercel

# Link to existing project
vercel link

# Deploy preview
vercel

# Deploy to production
vercel --prod

# Pull environment variables
vercel env pull .env.local
```

### Database Commands

```bash
# Generate migration
npm run db:generate

# Run migrations
npm run db:migrate

# Open database GUI
npm run db:studio

# Push schema directly (careful!)
npm run db:push
```

### Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Sentry Dashboard](https://sentry.io)
- [Neon Console](https://console.neon.tech)
- [Supabase Dashboard](https://supabase.com/dashboard)
