# Authentication System

This template uses **Better Auth** for authentication, supporting email/password, social login (Google), two-factor authentication, organizations with role-based access control and user management features.

---

## Quick Setup

### 1. Generate Auth Secret

```bash
npx @better-auth/cli secret
# or
openssl rand -base64 32
```

Add to `.env`:

```bash
BETTER_AUTH_SECRET="your-generated-secret"
```

### 2. Run Database Migrations

```bash
npm run db:migrate
```

### 3. (Optional) Add Google OAuth

```bash
GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxx"
```

**Redirect URI**: `https://yourdomain.com/api/auth/callback/google`

That's it! Authentication is ready.

---

## Authentication Methods

### Email/Password

- Email verification required before sign-in
- Minimum 8 character password (configurable)
- Password reset via email

### Google OAuth

- "Sign in with Google" button
- Account linking (connect Google to existing email account)
- Auto-creates user on first sign-in

### Two-Factor Authentication (2FA)

- TOTP-based (Google Authenticator, Authy, etc.)
- Backup codes for recovery
- Can be enabled per user in account settings

---

## Role System

This template uses a **two-tier role system**:

### 1. Platform Role (`user.role`)

Global platform-level permissions stored on the `user` table.

| Role    | Description             |
| ------- | ----------------------- |
| `user`  | Standard user (default) |
| `admin` | Platform administrator  |

**What Platform Admins Can Do:**

- Access `/dashboard/admin` panel
- View and search all users
- Ban/unban users
- View and manage all organizations
- Impersonate users for debugging

### 2. Organization Role (`member.role`)

Per-organization permissions stored on the `member` table.

| Role     | Description                                |
| -------- | ------------------------------------------ |
| `owner`  | Full control (creator of the organization) |
| `admin`  | Can manage members, settings, billing      |
| `member` | Standard access to organization features   |

**Permission Matrix:**

| Action                      | Owner | Admin | Member |
| --------------------------- | :---: | :---: | :----: |
| View organization dashboard |  ✅   |  ✅   |   ✅   |
| Create/edit data            |  ✅   |  ✅   |   ✅   |
| Invite members              |  ✅   |  ✅   |   ❌   |
| Remove members              |  ✅   |  ✅   |   ❌   |
| Change member roles         |  ✅   |  ✅   |   ❌   |
| Edit organization settings  |  ✅   |  ✅   |   ❌   |
| Manage billing              |  ✅   |  ✅   |   ❌   |
| Delete organization         |  ✅   |  ❌   |   ❌   |
| Transfer ownership          |  ✅   |  ❌   |   ❌   |

**Important Notes:**

- Platform admin ≠ Organization admin (separate systems)
- Users can have different roles in different organizations
- Creating an organization makes you the owner

---

## Server-Side Usage

### Get Current Session

```typescript
import { getSession } from "@/lib/auth/server";

// In a Server Component or API route
const session = await getSession();

if (session) {
  console.log(session.user.email);
  console.log(session.user.role);
}
```

### Get Organization

```typescript
import { getOrganizationById, getOrganizationList } from "@/lib/auth/server";

// Get specific organization
const org = await getOrganizationById(organizationId);

// Get all user's organizations
const orgs = await getOrganizationList();
```

### Verify Membership

```typescript
import { assertUserIsOrgMember } from "@/lib/auth/server";

const { organization, membership } = await assertUserIsOrgMember(
  organizationId,
  userId
);
// Throws TRPCError if not a member
```

---

## Client-Side Usage

### Session Hook

```typescript
import { useSession } from "@/hooks/use-session";

function MyComponent() {
  const { user, session, loaded, reloadSession } = useSession();

  if (!loaded) return <Spinner />;
  if (!user) return <SignInPrompt />;

  return <div>Welcome, {user.name}!</div>;
}
```

### Auth Client

```typescript
import { authClient } from "@/lib/auth/client";

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "password",
});

// Sign out
await authClient.signOut();

// Get session
const session = await authClient.getSession();

// Organization operations
await authClient.organization.create({ name: "My Org" });
await authClient.organization.setActive({ organizationId: "..." });
```

---

## Protecting Routes

### tRPC Procedures

```typescript
import {
  publicProcedure,
  protectedProcedure,
  protectedAdminProcedure,
  protectedOrganizationProcedure,
} from "@/trpc/init";

export const myRouter = createTRPCRouter({
  // No auth required
  publicData: publicProcedure.query(async () => {
    return { message: "Hello!" };
  }),

  // Requires login
  userData: protectedProcedure.query(async ({ ctx }) => {
    // ctx.user is available
    return { userId: ctx.user.id };
  }),

  // Requires platform admin role
  adminData: protectedAdminProcedure.query(async ({ ctx }) => {
    // ctx.user.role is guaranteed to be "admin"
    return { adminOnly: true };
  }),

  // Requires organization membership
  orgData: protectedOrganizationProcedure.query(async ({ ctx }) => {
    // ctx.organization and ctx.membership available
    return { orgId: ctx.organization.id };
  }),
});
```

### Check Organization Role

```typescript
protectedOrganizationProcedure.mutation(async ({ ctx }) => {
  // Check if user is owner or admin
  if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only owners and admins can do this",
    });
  }

  // Proceed with action...
});
```

### Helper Function

```typescript
import { isOrganizationAdmin } from "@/lib/auth/utils";

// Returns true if user is platform admin OR organization owner/admin
if (isOrganizationAdmin(organization, user)) {
  // User has admin access
}
```

---

## Making a User Admin

### Option 1: Drizzle Studio (Recommended)

```bash
npm run db:studio
```

1. Open [https://local.drizzle.studio](https://local.drizzle.studio)
2. Click on the `user` table
3. Find the user and edit
4. Change `role` from `user` to `admin`
5. Save

### Option 2: SQL Command

```bash
docker exec -it template-drizzle-db-1 psql -U postgres -d database -c \
  "UPDATE \"user\" SET role = 'admin' WHERE email = 'your@email.com';"
```

### Option 3: Code

```typescript
import { db } from "@/lib/db";
import { userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

await db
  .update(userTable)
  .set({ role: "admin" })
  .where(eq(userTable.email, "your@email.com"));
```

---

## User Banning

### How It Works

Admins can ban users with optional expiry dates. Banned users:

- Cannot sign in
- Get redirected to `/auth/banned` if already signed in
- Are automatically unbanned when `banExpires` passes

### Ban a User

```typescript
// Via tRPC (admin only)
await trpc.adminUsers.banUser.mutate({
  userId: "...",
  reason: "Violation of terms",
  expiresAt: new Date("2024-12-31"), // Optional
});
```

### Unban a User

```typescript
await trpc.adminUsers.unbanUser.mutate({
  userId: "...",
});
```

### Database Fields

```typescript
// On user table
banned: boolean; // Is user banned
banReason: string; // Why they were banned
banExpires: timestamp; // When ban expires (null = permanent)
```

---

## Impersonation

Platform admins can impersonate users for debugging.

### Start Impersonation

```typescript
// Via Better Auth admin client
await authClient.admin.impersonateUser({
  userId: "target-user-id",
});
```

### Check If Impersonating

```typescript
// Server-side (tRPC)
if (ctx.isImpersonating) {
  // Current session is impersonated
}

// Client-side
const session = await authClient.getSession();
if (session?.session.impersonatedBy) {
  // Impersonated by admin with this ID
}
```

### Stop Impersonation

```typescript
await authClient.admin.stopImpersonation();
```

---

## Organizations

### Create Organization

```typescript
// Client-side
await authClient.organization.create({
  name: "My Company",
  slug: "my-company", // Optional, auto-generated if not provided
});
```

### Set Active Organization

```typescript
await authClient.organization.setActive({
  organizationId: "org-id",
});
```

### Invite Members

```typescript
await authClient.organization.inviteMember({
  email: "newmember@example.com",
  role: "member", // or "admin"
  organizationId: "org-id",
});
```

### Accept Invitation

Invitations include a link with `?invitationId=xxx&email=xxx`. The sign-up/sign-in pages handle this automatically.

---

## Email Templates

Auth-related emails are sent for:

| Event               | Template                             |
| ------------------- | ------------------------------------ |
| Sign up             | `verify-email-address-email`         |
| Password reset      | `password-reset-email`               |
| Email change        | `confirm-email-address-change-email` |
| Organization invite | `organization-invitation-email`      |
| Welcome             | `welcome-email`                      |

Templates are in `lib/email/templates/` using React Email.

---

## Bot Protection (Turnstile)

Optional Cloudflare Turnstile CAPTCHA on auth forms.

### Setup

```bash
TURNSTILE_SECRET_KEY="0x4xxxxx"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4xxxxx"
```

Get keys from [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile).

### Usage in Forms

```typescript
import { useTurnstile } from "@/hooks/use-turnstile";

function SignInForm() {
  const { captchaToken, captchaEnabled, turnstileRef } = useTurnstile();

  const handleSignIn = async () => {
    await authClient.signIn.email(
      { email, password },
      {
        fetchOptions: captchaEnabled
          ? { headers: { "x-captcha-response": captchaToken } }
          : undefined,
      }
    );
  };

  return (
    <form>
      {/* form fields */}
      {captchaEnabled && <Turnstile ref={turnstileRef} sitekey={...} />}
    </form>
  );
}
```

---

## Configuration

### `config/auth.config.ts`

```typescript
export const authConfig = {
  redirectAfterSignIn: "/dashboard",
  redirectAfterLogout: "/",
  sessionCookieMaxAge: 60 * 60 * 24 * 30, // 30 days
  verificationExpiresIn: 60 * 60 * 24 * 14, // 14 days
  minimumPasswordLength: 8,
  enableSignup: true,           // Set false for invitation-only
  enableSocialLogin: true,      // Set false to disable OAuth
  trustedOrigins: [...],
  cors: {...},
};
```

### Disable Public Signup

Set `enableSignup: false` for invitation-only mode. Users can only join via organization invitations.

---

## Adding a New OAuth Provider

1. **Add to Better Auth config** (`lib/auth/index.ts`):

```typescript
socialProviders: {
  google: { ... },
  github: {
    clientId: env.GITHUB_CLIENT_ID ?? "",
    clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
    scope: ["user:email"],
  },
},
```

2. **Add environment variables**:

```bash
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."
```

3. **Add provider icon** (`lib/auth/oauth-providers.tsx`):

```typescript
export const oAuthProviders = [
  { id: "google", name: "Google", icon: <GoogleIcon /> },
  { id: "github", name: "GitHub", icon: <GitHubIcon /> },
];
```

4. **Configure redirect URI** in the provider's dashboard:
   `https://yourdomain.com/api/auth/callback/github`

---

## Adding Custom User Fields

1. **Add column** to `lib/db/schema/tables.ts`:

```typescript
export const userTable = pgTable("user", {
  // ... existing fields
  companyName: text("company_name"),
});
```

2. **Add to Better Auth config** (`lib/auth/index.ts`):

```typescript
user: {
  additionalFields: {
    companyName: {
      type: "string",
      required: false,
    },
  },
},
```

3. **Run migration**:

```bash
npm run db:generate
npm run db:migrate
```

---

## Environment Variables

### Required

```bash
BETTER_AUTH_SECRET="..."  # Generate with: npx @better-auth/cli secret
```

### Optional

```bash
# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Bot Protection
TURNSTILE_SECRET_KEY=""
NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
```

---

## File Reference

| File                             | Purpose                          |
| -------------------------------- | -------------------------------- |
| `config/auth.config.ts`          | Auth configuration               |
| `lib/auth/index.ts`              | Better Auth setup                |
| `lib/auth/client.ts`             | Client-side auth client          |
| `lib/auth/server.ts`             | Server-side helpers              |
| `lib/auth/utils.ts`              | Password validator, role helpers |
| `lib/auth/constants.ts`          | Error messages, labels           |
| `lib/db/schema/tables.ts`        | Database tables                  |
| `lib/db/schema/enums.ts`         | Role enums                       |
| `trpc/init.ts`                   | Protected procedures             |
| `hooks/use-session.tsx`          | Client session hook              |
| `components/auth/*.tsx`          | Auth UI components               |
| `app/(saas)/auth/*`              | Auth pages                       |
| `app/api/auth/[...all]/route.ts` | Auth API handler                 |
| `proxy.ts`                       | Auth middleware                  |
