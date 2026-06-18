# Billing System

This template includes a full-featured Stripe billing integration supporting subscriptions, one-time payments (lifetime deals), per-seat pricing, trial periods and plan limits.

**Key Architecture**: Billing is tied to **organizations**, not individual users. Each organization has its own subscription and billing settings.

---

## Quick Setup

### 1. Get Stripe Keys

1. Create a [Stripe account](https://dashboard.stripe.com/register)
2. Get your API keys from [Dashboard > Developers > API keys](https://dashboard.stripe.com/apikeys)

```bash
# .env
STRIPE_SECRET_KEY="sk_test_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
```

### 2. Create Products & Prices

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Create a product (e.g., "Pro Plan")
3. Add prices for monthly and yearly billing
4. Copy the Price IDs (starts with `price_`)

```bash
# .env
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY="price_xxxxx"
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY="price_xxxxx"
NEXT_PUBLIC_STRIPE_PRICE_LIFETIME="price_xxxxx"  # Optional
```

### 3. Configure Plans

Edit `config/billing.config.ts` to match your Stripe prices:

```typescript
export const billingConfig = {
  enabled: true,
  defaultCurrency: "usd",
  plans: {
    free: {
      id: "free",
      name: "Free",
      description: "Get started with basic features",
      isFree: true,
      features: ["Up to 3 team members", "Basic analytics"],
      limits: { maxMembers: 3, maxStorage: 1 },
    },
    pro: {
      id: "pro",
      name: "Pro",
      description: "For growing teams",
      recommended: true,
      features: ["Unlimited team members", "Advanced analytics"],
      limits: { maxMembers: -1, maxStorage: 100 }, // -1 = unlimited
      prices: [
        {
          id: "pro_monthly",
          stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? "",
          type: "recurring",
          interval: "month",
          intervalCount: 1,
          amount: 2900, // $29.00 in cents
          currency: "usd",
          seatBased: true,
          trialDays: 14,
        },
        {
          id: "pro_yearly",
          stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY ?? "",
          type: "recurring",
          interval: "year",
          intervalCount: 1,
          amount: 27800, // $278.00 in cents
          currency: "usd",
          seatBased: true,
          trialDays: 14,
        },
      ],
    },
  },
};
```

### 4. Set Up Webhooks

**Local Development:**

```bash
npm run stripe:listen
```

This forwards Stripe events to `http://localhost:3000/api/webhooks/stripe`.

**Production:**

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events to listen to:
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
   - `refund.created`
   - `refund.updated`
   - `refund.failed`
   - `payment_intent.succeeded`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
   - `charge.dispute.funds_withdrawn`
   - `charge.dispute.funds_reinstated`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Plan Types

### Free Plan

No Stripe price needed. Default tier when billing is enabled.

```typescript
free: {
  id: "free",
  name: "Free",
  isFree: true,
  features: [...],
  limits: { maxMembers: 3, maxStorage: 1 },
}
```

### Paid Plan (Subscription)

Recurring billing with optional trial period and per-seat pricing.

```typescript
pro: {
  id: "pro",
  name: "Pro",
  recommended: true,
  features: [...],
  limits: { maxMembers: -1, maxStorage: 100 },
  prices: [
    {
      id: "pro_monthly",
      stripePriceId: "price_xxx",
      type: "recurring",
      interval: "month",
      amount: 2900,
      currency: "usd",
      seatBased: true,  // Charge per team member
      trialDays: 14,    // Free trial
    },
  ],
}
```

### Lifetime Plan (One-Time)

Single payment for permanent access.

```typescript
lifetime: {
  id: "lifetime",
  name: "Lifetime",
  features: [...],
  limits: { maxMembers: -1, maxStorage: 100 },
  prices: [
    {
      id: "lifetime_once",
      stripePriceId: "price_xxx",
      type: "one_time",
      amount: 49900, // $499.00
      currency: "usd",
    },
  ],
}
```

### Enterprise Plan

Contact sales, no self-service checkout.

```typescript
enterprise: {
  id: "enterprise",
  name: "Enterprise",
  isEnterprise: true,
  features: [...],
  limits: { maxMembers: -1, maxStorage: -1 },
}
```

---

## Protecting Features

### Require Any Paid Plan

```typescript
import { requirePaidPlan } from "@/lib/billing/guards";

export const myRouter = createTRPCRouter({
  premiumFeature: protectedOrganizationProcedure.mutation(async ({ ctx }) => {
    // Throws FORBIDDEN if on free plan
    await requirePaidPlan(ctx.organization.id);
    
    // Premium feature logic...
  }),
});
```

### Require Specific Plans

```typescript
import { requireSpecificPlan } from "@/lib/billing/guards";

export const myRouter = createTRPCRouter({
  enterpriseOnly: protectedOrganizationProcedure.mutation(async ({ ctx }) => {
    // Only allow enterprise or lifetime plans
    await requireSpecificPlan(ctx.organization.id, ["enterprise", "lifetime"]);
    
    // Enterprise feature logic...
  }),
});
```

### Check Plan Limits

```typescript
import { getOrganizationPlanLimits, requireMemberSlot } from "@/lib/billing/guards";

// Check limits manually
const limits = await getOrganizationPlanLimits(organizationId);
if (limits.maxMembers !== -1 && memberCount >= limits.maxMembers) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Member limit reached. Please upgrade your plan.",
  });
}

// Or use the helper
await requireMemberSlot(organizationId, currentMemberCount);
```

### Check Payment Status

```typescript
import { getPaymentStatus, requireGoodStanding } from "@/lib/billing/guards";

// Get detailed status
const status = await getPaymentStatus(organizationId);
// Returns: { hasAccess, status, gracePeriodDaysRemaining, message }

// Or throw if payment required
await requireGoodStanding(organizationId);
```

---

## Client Usage

### Get Current Plan

```typescript
const { data } = trpc.organizationBilling.getStatus.useQuery();
// data.activePlan: { id, name, ... }
// data.subscription: { status, cancelAtPeriodEnd, ... }
// data.hasPaidPlan: boolean
```

### Create Checkout

```typescript
const createCheckout = trpc.organizationBilling.createCheckout.useMutation();

const handleUpgrade = async (priceId: string) => {
  const { url } = await createCheckout.mutateAsync({
    stripePriceId: priceId,
    successUrl: `${window.location.origin}/dashboard/settings?success=true`,
    cancelUrl: `${window.location.origin}/dashboard/settings?canceled=true`,
  });
  
  window.location.href = url;
};
```

### Open Customer Portal

```typescript
const createPortal = trpc.organizationBilling.createPortalSession.useMutation();

const handleManageBilling = async () => {
  const { url } = await createPortal.mutateAsync({
    returnUrl: window.location.href,
  });
  
  window.location.href = url;
};
```

### Cancel Subscription

```typescript
const cancel = trpc.organizationBilling.cancelSubscription.useMutation();

await cancel.mutateAsync({ subscriptionId });
// Cancels at end of billing period
```

---

## Database Schema

### Subscription Table

Stores Stripe subscription data for quick access:

| Column | Description |
|--------|-------------|
| `id` | Stripe subscription ID (`sub_xxx`) |
| `organizationId` | FK to organization |
| `status` | `active`, `trialing`, `past_due`, `canceled`, etc. |
| `stripePriceId` | Current price ID |
| `quantity` | Seat count for per-seat billing |
| `currentPeriodEnd` | When current period ends |
| `cancelAtPeriodEnd` | Scheduled for cancellation |
| `trialEnd` | When trial ends |

### Order Table

Stores one-time payments (lifetime deals):

| Column | Description |
|--------|-------------|
| `id` | UUID |
| `organizationId` | FK to organization |
| `status` | `completed`, `refunded` |
| `totalAmount` | Amount in cents |
| `stripePaymentIntentId` | Stripe payment intent |

### Billing Event Table

Audit log of all Stripe events:

| Column | Description |
|--------|-------------|
| `stripeEventId` | Unique event ID (for idempotency) |
| `eventType` | e.g., `invoice.paid` |
| `organizationId` | Related organization |
| `processed` | Whether event was handled |

---

## Webhook Events

The webhook handler at `/api/webhooks/stripe` processes these events:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create order for one-time payments, process credit purchases |
| `customer.subscription.created` | Create subscription record |
| `customer.subscription.updated` | Update status, plan changes |
| `customer.subscription.deleted` | Mark canceled, send notification |
| `customer.subscription.paused` | Update status to paused |
| `customer.subscription.resumed` | Update status to active |
| `customer.subscription.trial_will_end` | Send trial ending email (3 days before) |
| `invoice.paid` | Log successful payment |
| `invoice.payment_failed` | Send payment failed email |
| `charge.refunded` | Revoke access for full refunds |
| `refund.created` | Track refund initiation |
| `refund.updated` | Update refund status |
| `refund.failed` | Log refund failure |
| `charge.dispute.created` | Alert admins, log dispute |
| `charge.dispute.updated` | Update dispute status |
| `charge.dispute.closed` | Log dispute resolution |
| `customer.deleted` | Clear Stripe customer ID |
| `payment_intent.succeeded` | Log payment for audit trail |

**Idempotency**: Events are logged to `billingEventTable` before processing. Duplicate events are automatically skipped.

**Error Handling**: Transient errors (network issues) return 500 for Stripe retry. Permanent errors return 200 to prevent endless retries.

---

## Grace Period

Failed payments don't immediately revoke access:

- **Active/Trialing**: Full access
- **Past Due**: 7-day grace period (configurable)
- **Unpaid/Canceled**: No access

Configure in `lib/billing/guards.ts`:

```typescript
const GRACE_PERIOD_DAYS = 7;  // Set to 0 for immediate revocation
```

---

## Per-Seat Billing

When `seatBased: true`, subscription quantity matches member count:

1. At checkout, quantity = current member count (minimum 1)
2. When members added/removed, seats auto-sync (if enabled)
3. Prorated charges/credits applied by Stripe

```typescript
// Manual seat sync
import { syncOrganizationSeats } from "@/lib/billing/seat-sync";

await syncOrganizationSeats(organizationId, { force: true });
```

---

## UI Components

### Pricing Table

```tsx
import { PricingTable } from "@/components/billing/pricing-table";

<PricingTable
  plans={plans}
  currentPlanId={currentPlan?.id}
  onSelectPlan={(priceId) => handleCheckout(priceId)}
  defaultInterval="month"
  yearlySavingsPercent={20}
/>
```

### Current Plan Card

```tsx
import { CurrentPlanCard } from "@/components/billing/current-plan-card";

<CurrentPlanCard
  planName="Pro"
  status="active"
  currentPeriodEnd={new Date()}
  onManageBilling={() => openPortal()}
/>
```

### Billing Settings Tab

Full billing settings page with plan display, upgrade options and invoice history:

```tsx
import { BillingSettingsTab } from "@/components/billing/billing-settings-tab";

<BillingSettingsTab />
```

---

## Adding a New Plan

1. **Create price in Stripe Dashboard**
2. **Add environment variable**:
   ```bash
   NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_xxx
   ```
3. **Update billing config**:
   ```typescript
   team: {
     id: "team",
     name: "Team",
     features: [...],
     limits: { maxMembers: 10, maxStorage: 50 },
     prices: [{
       id: "team_monthly",
       stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY ?? "",
       type: "recurring",
       interval: "month",
       amount: 4900,
       currency: "usd",
     }],
   }
   ```

---

## Adding a New Limit

1. **Extend PlanLimits type** in `config/billing.config.ts`:
   ```typescript
   export type PlanLimits = {
     maxMembers: number;
     maxStorage: number;
     maxProjects: number;  // New limit
   };
   ```

2. **Update DEFAULT_PLAN_LIMITS** in `lib/billing/plans.ts`:
   ```typescript
   export const DEFAULT_PLAN_LIMITS: PlanLimits = {
     maxMembers: 3,
     maxStorage: 1,
     maxProjects: 5,
   };
   ```

3. **Add to each plan** in config

4. **Create guard function** in `lib/billing/guards.ts`:
   ```typescript
   export async function requireProjectSlot(
     organizationId: string,
     currentCount: number,
   ): Promise<void> {
     const limits = await getOrganizationPlanLimits(organizationId);
     if (limits.maxProjects !== -1 && currentCount >= limits.maxProjects) {
       throw new TRPCError({
         code: "FORBIDDEN",
         message: "Project limit reached. Please upgrade your plan.",
       });
     }
   }
   ```

---

## Disabling Billing

Set `enabled: false` in config:

```typescript
export const billingConfig = {
  enabled: false,  // All guard functions will pass
  // ...
};
```

Or simply don't set `STRIPE_SECRET_KEY` - guards automatically pass when Stripe isn't configured.

---

## Testing

### Test Mode

Use Stripe test mode keys (`sk_test_xxx`) for development.

### Test Cards

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Declined |

### Trigger Webhooks Locally

```bash
# Forward events to local server
npm run stripe:listen

# Trigger specific events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
```

---

## Troubleshooting

### Webhook Signature Verification Failed

- Ensure `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret
- For local dev, use the secret from `stripe listen` output
- For production, use the secret from Stripe Dashboard

### Subscription Not Syncing

- Check webhook endpoint is receiving events in Stripe Dashboard
- Check `billingEventTable` for errors
- Verify customer has `stripeCustomerId` on organization
- Use the admin panel's **Sync from Stripe** feature to manually sync (see below)

### Grace Period Not Working

- Verify subscription status is `past_due` (not `active`)
- Check `GRACE_PERIOD_DAYS` constant in guards.ts
- Ensure `currentPeriodEnd` is set on subscription

---

## Admin: On-Demand Stripe Sync

If subscriptions get out of sync (missed webhooks, database restore, manual Stripe changes), admins can manually sync from the admin panel.

### How to Use

1. Go to **Admin Panel > Subscriptions** (`/dashboard/admin/subscriptions`)
2. Select the subscriptions you want to sync (max 100 at a time)
3. Click **Actions > Sync from Stripe**
4. Confirm the sync operation

### What Gets Synced

| Data | Action |
|------|--------|
| Subscription status | Updated from Stripe |
| Current period dates | Updated from Stripe |
| Price/Plan | Updated from Stripe |
| Quantity (seats) | Updated from Stripe |
| Cancel settings | Updated from Stripe |
| Subscription items | Replaced with Stripe data |

### Programmatic Sync

```typescript
import { syncSelectedSubscriptions } from "@/lib/billing/sync";

// Sync specific subscriptions
const result = await syncSelectedSubscriptions([
  "sub_xxx",
  "sub_yyy",
]);

// Result includes details for each subscription
// result.successful: number
// result.failed: number
// result.skipped: number
// result.results: Array<{ subscriptionId, success, error? }>
```

### Sync Limits

- **Max 100 subscriptions** per sync operation
- **50ms delay** between Stripe API calls (rate limiting)
- Only syncs subscriptions that **exist locally** (skips unknown IDs)

### When to Use

- After database restoration from backup
- When webhook endpoint was down
- To verify local data matches Stripe
- After manual changes in Stripe Dashboard

---

## File Reference

| File | Purpose |
|------|---------|
| `config/billing.config.ts` | Plans, prices, limits, credit packages |
| `lib/billing/guards.ts` | Access control functions |
| `lib/billing/checkout.ts` | Checkout session creation |
| `lib/billing/subscriptions.ts` | Subscription operations |
| `lib/billing/customer.ts` | Customer management |
| `lib/billing/queries.ts` | Database queries |
| `lib/billing/plans.ts` | Plan lookup helpers |
| `lib/billing/seat-sync.ts` | Per-seat billing sync |
| `lib/billing/notifications.ts` | Email notifications |
| `lib/billing/credits.ts` | Credit operations service |
| `app/api/webhooks/stripe/route.ts` | Webhook handler |
| `trpc/routers/organization/organization-billing.ts` | Billing API endpoints |
| `trpc/routers/organization/organization-credits.ts` | Credits API endpoints |
| `trpc/routers/admin/admin-credits.ts` | Admin credits management |
| `components/billing/*.tsx` | UI components |

---

# AI Credits System

The billing system includes a prepaid **AI credits** feature. Organizations purchase credits and consume them when using AI features (chat, document analysis, etc.).

## Architecture

Credits are stored **in your database** (not Stripe). Stripe only handles payment for credit packages. This provides:

- Real-time balance updates
- Full control over credit logic
- Works with any pricing model
- No dependency on Stripe Preview APIs

```
┌───────────────────────────────────────────────────────────────┐
│                     CREDIT FLOW                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Purchase: User → Stripe Checkout → Webhook → DB Balance      │
│                                                               │
│  Usage:    AI Feature → Check Balance → Deduct → Transaction  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Quick Setup

### 1. Create Credit Products in Stripe

1. Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products)
2. Create products for each credit package:
   - "Starter Credits" - $9.99 one-time
   - "Basic Credits" - $39.99 one-time
   - "Pro Credits" - $149.99 one-time
3. Copy the Price IDs

### 2. Add Environment Variables

```bash
# .env
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_STARTER="price_xxxxx"
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_BASIC="price_xxxxx"
NEXT_PUBLIC_STRIPE_PRICE_CREDITS_PRO="price_xxxxx"
```

### 3. Configure Credit Packages

Packages are configured in `config/billing.config.ts`:

```typescript
export const creditPackages = [
  {
    id: "credits_starter",
    name: "Starter",
    description: "Great for trying out AI features",
    credits: 10_000,
    bonusCredits: 0,
    priceAmount: 999, // $9.99 in cents
    currency: "usd",
    stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_STARTER ?? "",
    popular: false,
  },
  {
    id: "credits_basic",
    name: "Basic",
    description: "For regular AI usage",
    credits: 50_000,
    bonusCredits: 5_000, // 10% bonus
    priceAmount: 3999,
    currency: "usd",
    stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_BASIC ?? "",
    popular: true,
  },
  {
    id: "credits_pro",
    name: "Pro",
    description: "Best value for power users",
    credits: 200_000,
    bonusCredits: 40_000, // 20% bonus
    priceAmount: 14999,
    currency: "usd",
    stripePriceId: env.NEXT_PUBLIC_STRIPE_PRICE_CREDITS_PRO ?? "",
    popular: false,
  },
];
```

---

## Credit Cost Configuration

AI models have different credit costs based on token usage. Configure in `config/billing.config.ts`:

```typescript
export const creditCosts = {
  // Budget tier
  "gpt-4o-mini": {
    input: 1,    // 1 credit per 1K input tokens
    output: 6,   // 6 credits per 1K output tokens
  },
  // Standard tier  
  "gpt-4o": {
    input: 25,
    output: 100,
  },
  // Premium tier
  "claude-3-5-sonnet": {
    input: 30,
    output: 150,
  },
  // Reasoning models
  "o1": {
    input: 150,
    output: 600,
  },
} as const;
```

**Pricing methodology:**
- 1 credit ≈ $0.001 (1/10th of a cent)
- Prices include ~5-10x markup over API costs
- Typical chat message: 3-15 credits (budget) to 50-200 credits (standard)

---

## Database Schema

### Credit Balance Table

Denormalized balance per organization for fast reads:

| Column | Description |
|--------|-------------|
| `organizationId` | FK to organization (unique) |
| `balance` | Current credit balance |
| `lifetimePurchased` | Total credits ever purchased |
| `lifetimeGranted` | Total bonus/promo credits |
| `lifetimeUsed` | Total credits consumed |
| `lifetimeExpired` | Total credits expired |

### Credit Transaction Table

Immutable ledger of all credit changes:

| Column | Description |
|--------|-------------|
| `type` | `purchase`, `usage`, `bonus`, `promo`, `refund`, `adjustment`, etc. |
| `amount` | Positive = add, negative = deduct |
| `balanceAfter` | Running balance after transaction |
| `model` | AI model used (for usage transactions) |
| `inputTokens` | Tokens consumed (input) |
| `outputTokens` | Tokens consumed (output) |
| `referenceType` | Source: `order`, `ai_chat`, `admin`, etc. |
| `referenceId` | Related entity ID |

---

## Server-Side Usage

### Check Credit Balance

```typescript
import { getCreditBalance, hasEnoughCredits } from "@/lib/billing/credits";

// Get full balance details
const balance = await getCreditBalance(organizationId);
console.log(balance.balance); // Current credits

// Quick check
const canProceed = await hasEnoughCredits(organizationId, 100);
```

### Consume Credits (AI Usage)

```typescript
import { consumeCredits, InsufficientCreditsError } from "@/lib/billing/credits";

try {
  const { transaction, remainingBalance } = await consumeCredits({
    organizationId,
    amount: 50,
    description: "AI Chat (gpt-4o-mini)",
    model: "gpt-4o-mini",
    inputTokens: 1500,
    outputTokens: 800,
    referenceType: "ai_chat",
    referenceId: chatId,
    createdBy: userId,
  });
  
  console.log(`Remaining: ${remainingBalance}`);
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    // Handle insufficient credits
    console.log(`Need ${error.required}, have ${error.available}`);
  }
}
```

### Add Credits (Purchase/Grant)

```typescript
import { addCredits } from "@/lib/billing/credits";
import { CreditTransactionType } from "@/lib/db/schema/enums";

// After Stripe webhook confirms payment
await addCredits({
  organizationId,
  amount: 50000,
  type: CreditTransactionType.purchase,
  description: "Purchased Basic credit package",
  referenceType: "checkout_session",
  referenceId: stripeSessionId,
  createdBy: userId,
});

// Add bonus credits
await addCredits({
  organizationId,
  amount: 5000,
  type: CreditTransactionType.bonus,
  description: "Bonus credits from Basic package",
  referenceType: "checkout_session",
  referenceId: stripeSessionId,
});
```

### Admin Credit Adjustment

```typescript
import { adjustCredits } from "@/lib/billing/credits";

// Add credits (positive amount)
await adjustCredits({
  organizationId,
  amount: 1000,
  description: "Compensation for service issue",
  createdBy: adminUserId,
});

// Remove credits (negative amount)
await adjustCredits({
  organizationId,
  amount: -500,
  description: "Correction for billing error",
  createdBy: adminUserId,
});
```

### Calculate Credit Cost

```typescript
import { calculateCreditCost, estimateCreditCost } from "@/lib/billing/credits";

// Exact cost (after AI response)
const cost = calculateCreditCost("gpt-4o-mini", inputTokens, outputTokens);

// Estimate before sending (for pre-check)
const estimated = estimateCreditCost("gpt-4o-mini", messages);
```

---

## Client-Side Usage

### Get Balance

```typescript
const { data } = trpc.organization.credits.getBalance.useQuery();
// data.balance: number
// data.lifetimePurchased: number
// data.lifetimeGranted: number
// data.lifetimeUsed: number
```

### Get Transactions

```typescript
const { data } = trpc.organization.credits.getTransactions.useQuery({
  limit: 20,
  offset: 0,
});
// data: Array<{ id, type, amount, balanceAfter, description, model, createdAt }>
```

### Purchase Credits

```typescript
const purchaseMutation = trpc.organization.credits.purchaseCredits.useMutation({
  onSuccess: (data) => {
    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe Checkout
    }
  },
});

purchaseMutation.mutate({ packageId: "credits_basic" });
```

---

## AI Chat Integration

The AI chat route (`app/api/ai/chat/route.ts`) integrates with credits:

```typescript
// 1. Check balance before streaming
const balance = await getCreditBalance(organizationId);
const estimatedCost = estimateCreditCost(model, messages);

if (balance.balance < estimatedCost) {
  return Response.json({
    error: "insufficient_credits",
    balance: balance.balance,
    estimated: estimatedCost,
  }, { status: 402 });
}

// 2. Stream the response
const result = streamText({
  model: openai(model),
  messages,
  async onFinish({ usage }) {
    // 3. Deduct actual credits after completion
    const actualCost = calculateCreditCost(
      model,
      usage.promptTokens,
      usage.completionTokens
    );
    
    await consumeCredits({
      organizationId,
      amount: actualCost,
      description: `AI Chat (${model})`,
      model,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      referenceType: "ai_chat",
      referenceId: chatId,
      createdBy: userId,
    });
  },
});
```

---

## Webhook Handler

Credit purchases are processed via webhook (`checkout.session.completed`):

```typescript
// In app/api/webhooks/stripe/route.ts
case "checkout.session.completed":
  const session = event.data.object;
  
  if (session.metadata?.type === "credit_purchase") {
    await handleCreditPurchase(event.id, session);
  }
  break;
```

The handler:
1. Validates the package exists
2. Adds base credits as `purchase` transaction
3. Adds bonus credits as `bonus` transaction (if any)
4. Logs the billing event

---

## Admin Panel

Platform admins can manage credits via the admin panel:

- **View all credit balances** across organizations
- **Search and filter** by organization name or balance range
- **Adjust credits** (add or subtract with audit trail)
- **Export to CSV/Excel** for reporting

Access at: `/dashboard/admin/credits`

### Admin tRPC Endpoints

```typescript
// Get all balances (paginated, searchable)
trpc.admin.credits.getAllBalances.useQuery({
  limit: 25,
  offset: 0,
  query: "search term",
  filters: { balanceRange: ["low", "medium"] },
});

// Adjust credits for any organization
trpc.admin.credits.adjustCredits.useMutation({
  organizationId,
  amount: 1000, // positive to add, negative to remove
  description: "Reason for adjustment",
});

// Export to CSV/Excel
trpc.admin.credits.exportSelectedToCsv.useMutation({ organizationIds });
trpc.admin.credits.exportSelectedToExcel.useMutation({ organizationIds });
```

---

## UI Components

### Credits Settings Tab

Full credits management in organization settings:

```tsx
import { CreditsSettingsTab } from "@/components/billing/credits-settings-tab";

<CreditsSettingsTab isAdmin={isAdmin} />
```

Features:
- Current balance display
- Lifetime stats (purchased, granted, used)
- Transaction history with pagination
- Purchase modal with package selection
- Refresh button

---

## Error Handling

The credits service provides typed errors:

```typescript
import {
  InsufficientCreditsError,
  InvalidCreditAmountError,
  CreditBalanceError,
  MetadataTooLargeError,
} from "@/lib/billing/credits";

try {
  await consumeCredits({ ... });
} catch (error) {
  if (error instanceof InsufficientCreditsError) {
    // error.available - current balance
    // error.required - credits needed
    // error.userMessage - user-friendly message
  }
}
```

---

## Failed Deduction Tracking

If credit deduction fails after an AI response is already sent (rare race condition), failures are logged for reconciliation:

```typescript
import { 
  logFailedDeduction,
  getUnresolvedDeductionFailures,
  resolveDeductionFailure,
} from "@/lib/billing/credits";

// Logged automatically in AI chat route
await logFailedDeduction({
  organizationId,
  amount,
  errorCode: "INSUFFICIENT_CREDITS",
  model,
  referenceType: "ai_chat",
  referenceId: chatId,
});

// Admin can review and resolve
const failures = await getUnresolvedDeductionFailures();
await resolveDeductionFailure(failureId, adminUserId, "Manually deducted");
```

---

## Transaction Types

| Type | Direction | Description |
|------|-----------|-------------|
| `purchase` | + | User bought credits via Stripe |
| `subscription_grant` | + | Monthly subscription allocation |
| `bonus` | + | Bonus from package purchase |
| `promo` | + | Promotional credits (coupon, referral) |
| `usage` | - | Credits consumed by AI features |
| `refund` | + | Credits refunded |
| `expire` | - | Unused credits expired |
| `adjustment` | +/- | Manual admin adjustment |

---

## Best Practices

### 1. Always Pre-Check Balance

Before expensive AI operations, verify credits are available:

```typescript
const estimated = estimateCreditCost(model, messages);
if (!(await hasEnoughCredits(organizationId, estimated))) {
  throw new Error("Insufficient credits");
}
```

### 2. Use Atomic Transactions

All credit operations use database transactions with row locking to prevent race conditions:

```typescript
// This is handled internally by consumeCredits()
// Uses SELECT ... FOR UPDATE to lock the balance row
```

### 3. Log Context

Always provide meaningful descriptions and references:

```typescript
await consumeCredits({
  // ... 
  description: "AI Chat (gpt-4o-mini)", // User-visible
  referenceType: "ai_chat",             // For filtering
  referenceId: chatId,                  // For tracing
  createdBy: userId,                    // For audit
});
```

### 4. Handle Streaming Gracefully

For streaming AI responses, deduct credits in `onFinish`:

```typescript
streamText({
  // ...
  async onFinish({ usage }) {
    try {
      await consumeCredits({ ... });
    } catch (error) {
      // Log but don't fail - user already received response
      await logFailedDeduction({ ... });
    }
  },
});
```

---

## Troubleshooting

### Credits Not Added After Purchase

1. Check webhook is receiving `checkout.session.completed` events
2. Verify `metadata.type === "credit_purchase"` is set
3. Check `billingEventTable` for errors
4. Verify package ID matches config

### Incorrect Balance

1. Query `creditTransactionTable` to audit all transactions
2. Sum should equal current balance
3. Check for unresolved deduction failures

### Cost Calculations Off

1. Verify `creditCosts` config matches your pricing
2. Check token counts from AI provider
3. Review `calculateCreditCost` formula
