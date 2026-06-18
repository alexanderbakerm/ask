# SaaS Template

A production-ready SaaS boilerplate with authentication, billing, organizations and more.

## Tech Stack

| Category          | Technologies                               |
| ----------------- | ------------------------------------------ |
| **Framework**     | Next.js 16, React 19, TypeScript           |
| **Styling**       | Tailwind CSS 4, Radix UI, Lucide Icons     |
| **Data**          | tRPC, React Query, Drizzle ORM, PostgreSQL |
| **Auth**          | Better Auth (email, Google OAuth, 2FA)     |
| **Billing**       | Stripe (subscriptions, per-seat, one-time) |
| **Email**         | Resend, React Email                        |
| **Storage**       | S3-compatible (AWS S3 / Cloudflare R2)     |
| **Observability** | Sentry, Vercel Analytics                   |

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL and BETTER_AUTH_SECRET
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Full setup guide:** [README_QUICKSTART.md](./README_QUICKSTART.md)

## Documentation

| Document                                             | Description                                   |
| ---------------------------------------------------- | --------------------------------------------- |
| [README_QUICKSTART.md](./README_QUICKSTART.md)       | Step-by-step setup guide                      |
| [README_DATABASE.md](./README_DATABASE.md)           | Drizzle ORM, schema, migrations               |
| [README_AUTH.md](./README_AUTH.md)                   | Authentication, roles, sessions, 2FA          |
| [README_TRPC.md](./README_TRPC.md)                   | tRPC API layer and procedures                 |
| [README_BILLING.md](./README_BILLING.md)             | Stripe billing, subscriptions, webhooks       |
| [README_EMAIL.md](./README_EMAIL.md)                 | Resend email system and templates             |
| [README_STORAGE.md](./README_STORAGE.md)             | S3-compatible file storage                    |
| [README_CONTENT.md](./README_CONTENT.md)             | Blog, docs and marketing pages                |
| [README_AI.md](./README_AI.md)                       | AI chatbot system                             |
| [README_OBSERVABILITY.md](./README_OBSERVABILITY.md) | Sentry, logging, analytics                    |
| [README_DEPLOYMENT.md](./README_DEPLOYMENT.md)       | Vercel deployment guide                       |
| [AGENTS.md](./AGENTS.md)                             | AI agent guidelines (Cursor, Claude, Copilot) |
| [.env.example](./.env.example)                       | All environment variables                     |
| [LICENSE](./LICENSE)                                 | Achromatic License                            |

## Commands

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `npm run dev`           | Start development server        |
| `npm run build`         | Build for production            |
| `npm run db:migrate`    | Run database migrations         |
| `npm run db:studio`     | Open Drizzle Studio (DB GUI)    |
| `npm run docker:up`     | Start PostgreSQL                |
| `npm run stripe:listen` | Forward Stripe webhooks locally |
| `npm run deps:check`    | Check for dependency updates    |
| `npm run deps:update`   | Update package.json versions    |

## Configuration

### AI Credits

To enable AI credits, create three products in Stripe (Starter $9.99, Basic $39.99, Pro $149.99) and add their Price IDs to `.env`:

```bash
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_STARTER="price_..."
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_BASIC="price_..."
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_PRO="price_..."
```

For full setup details, see [README_BILLING.md](./README_BILLING.md#ai-credits-system).

## Project Structure

```
app/
├── (marketing)/     # Public pages (landing, blog, docs)
├── (saas)/          # Protected app (dashboard, settings)
└── api/             # API routes (auth, webhooks, tRPC)
components/          # React components
config/              # App, auth, billing configuration
lib/                 # Core libraries (auth, billing, db, email)
trpc/                # tRPC API routers
```

## License

[Achromatic License](./LICENSE)
