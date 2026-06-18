# Database System

This template uses **Drizzle ORM** with **PostgreSQL** for type-safe database operations. Drizzle provides excellent TypeScript integration, a powerful query builder and straightforward migrations.

---

## Quick Setup

### 1. Start PostgreSQL (Docker)

```bash
npm run docker:up
```

This starts PostgreSQL 17 on `localhost:5432`.

### 2. Run Migrations

```bash
npm run db:migrate
```

### 3. Open Database GUI

```bash
npm run db:studio
```

Opens Drizzle Studio at [https://local.drizzle.studio](https://local.drizzle.studio).

---

## Configuration

### Environment Variables

```bash
# .env
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="password"
POSTGRES_DB="database"
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
DATABASE_URL="postgresql://postgres:password@localhost:5432/database"
```

### Drizzle Config

```typescript
// drizzle.config.ts
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

---

## Schema Structure

```
lib/db/
├── index.ts          # Re-exports everything
├── client.ts         # Database client
└── schema/
    ├── index.ts      # Schema exports
    ├── tables.ts     # Table definitions
    ├── enums.ts      # Enum definitions
    └── relations.ts  # Relation definitions
```

### Import Pattern

```typescript
// Import everything you need from one place
import { db, userTable, leadTable, LeadStatus } from "@/lib/db";
```

---

## Tables Overview

### Authentication Tables

| Table               | Purpose                                 |
| ------------------- | --------------------------------------- |
| `userTable`         | User accounts with profile info         |
| `accountTable`      | OAuth/credential accounts (Better Auth) |
| `sessionTable`      | Active user sessions                    |
| `verificationTable` | Email verification tokens               |
| `twoFactorTable`    | 2FA secrets and backup codes            |

### Organization Tables

| Table               | Purpose                         |
| ------------------- | ------------------------------- |
| `organizationTable` | Organizations with billing info |
| `memberTable`       | Organization memberships        |
| `invitationTable`   | Pending invitations             |

### Billing Tables

| Table                   | Purpose                 |
| ----------------------- | ----------------------- |
| `subscriptionTable`     | Stripe subscriptions    |
| `subscriptionItemTable` | Subscription line items |
| `orderTable`            | One-time payments       |
| `orderItemTable`        | Order line items        |
| `billingEventTable`     | Webhook audit log       |

### Feature Tables

| Table         | Purpose                 |
| ------------- | ----------------------- |
| `leadTable`   | Leads/contacts          |
| `aiChatTable` | AI conversation history |

---

## Enums

### Role Enums

```typescript
// Platform role (user.role)
export const UserRole = {
  user: "user",
  admin: "admin",
} as const;

// Organization role (member.role)
export const MemberRole = {
  owner: "owner",
  admin: "admin",
  member: "member",
} as const;
```

### Status Enums

```typescript
// Lead pipeline stages
export const LeadStatus = {
  new: "new",
  contacted: "contacted",
  qualified: "qualified",
  proposal: "proposal",
  negotiation: "negotiation",
  won: "won",
  lost: "lost",
} as const;

// Subscription status (matches Stripe)
export const SubscriptionStatus = {
  active: "active",
  canceled: "canceled",
  trialing: "trialing",
  past_due: "past_due",
  // ... more
} as const;
```

### Using Enums

```typescript
import { LeadStatus, LeadStatuses } from "@/lib/db";

// Type-safe value
const status: LeadStatus = LeadStatus.qualified;

// Array of all values (for dropdowns)
LeadStatuses.map(status => <option key={status}>{status}</option>)
```

---

## Query Examples

### Basic Queries

```typescript
import { db, userTable, leadTable } from "@/lib/db";
import { eq, and, or, desc, asc, count, ilike, inArray } from "drizzle-orm";

// Find one
const user = await db.query.userTable.findFirst({
  where: eq(userTable.email, "user@example.com"),
});

// Find many with ordering
const leads = await db.query.leadTable.findMany({
  where: eq(leadTable.organizationId, orgId),
  orderBy: [desc(leadTable.createdAt)],
  limit: 50,
});
```

### With Relations

```typescript
// Load lead with assigned user
const lead = await db.query.leadTable.findFirst({
  where: eq(leadTable.id, leadId),
  with: {
    assignedTo: {
      columns: { id: true, name: true, email: true, image: true },
    },
  },
});

// Load organization with members
const org = await db.query.organizationTable.findFirst({
  where: eq(organizationTable.id, orgId),
  with: {
    members: {
      with: {
        user: {
          columns: { id: true, name: true, email: true },
        },
      },
    },
  },
});
```

### Insert

```typescript
// Single insert
const [lead] = await db
  .insert(leadTable)
  .values({
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    organizationId: ctx.organization.id,
  })
  .returning();

// Bulk insert
const leads = await db
  .insert(leadTable)
  .values([
    { firstName: "John", ... },
    { firstName: "Jane", ... },
  ])
  .returning();
```

### Update

```typescript
// Update with returning
const [updated] = await db
  .update(leadTable)
  .set({
    status: LeadStatus.qualified,
    updatedAt: new Date(),
  })
  .where(eq(leadTable.id, leadId))
  .returning();

// Multi-tenant safe update (atomic check)
const [updated] = await db
  .update(leadTable)
  .set(data)
  .where(
    and(
      eq(leadTable.id, leadId),
      eq(leadTable.organizationId, ctx.organization.id)
    )
  )
  .returning();

if (!updated) {
  throw new TRPCError({ code: "NOT_FOUND" });
}
```

### Delete

```typescript
// Delete with returning
const [deleted] = await db
  .delete(leadTable)
  .where(eq(leadTable.id, leadId))
  .returning();

// Bulk delete
const deleted = await db
  .delete(leadTable)
  .where(
    and(
      inArray(leadTable.id, ids),
      eq(leadTable.organizationId, ctx.organization.id)
    )
  )
  .returning({ id: leadTable.id });

console.log(`Deleted ${deleted.length} leads`);
```

### Upsert

```typescript
// Insert or update on conflict
const [subscription] = await db
  .insert(subscriptionTable)
  .values({
    id: stripeSubscriptionId,
    organizationId,
    status: "active",
    // ...
  })
  .onConflictDoUpdate({
    target: subscriptionTable.id,
    set: {
      status: "active",
      updatedAt: new Date(),
    },
  })
  .returning();
```

### Filtering & Search

```typescript
// Build dynamic conditions
const conditions = [eq(leadTable.organizationId, ctx.organization.id)];

// Add search
if (query) {
  conditions.push(
    or(
      ilike(leadTable.firstName, `%${query}%`),
      ilike(leadTable.lastName, `%${query}%`),
      ilike(leadTable.email, `%${query}%`)
    )!
  );
}

// Add status filter
if (statusFilter?.length) {
  conditions.push(inArray(leadTable.status, statusFilter));
}

const leads = await db.query.leadTable.findMany({
  where: and(...conditions),
  orderBy: [desc(leadTable.createdAt)],
  limit: 50,
  offset: page * 50,
});
```

### Aggregations

```typescript
// Count
const [{ count: total }] = await db
  .select({ count: count() })
  .from(leadTable)
  .where(eq(leadTable.organizationId, orgId));

// Select specific columns
const leads = await db
  .select({
    id: leadTable.id,
    name: sql`${leadTable.firstName} || ' ' || ${leadTable.lastName}`,
    email: leadTable.email,
  })
  .from(leadTable)
  .where(eq(leadTable.organizationId, orgId));
```

### Transactions

```typescript
const result = await db.transaction(async (tx) => {
  // All operations in this block are atomic

  // Delete old items
  await tx
    .delete(subscriptionItemTable)
    .where(eq(subscriptionItemTable.subscriptionId, subId));

  // Insert new items
  const items = await tx
    .insert(subscriptionItemTable)
    .values(newItems)
    .returning();

  return items;
});
```

---

## Adding a New Table

### 1. Define the Table

```typescript
// lib/db/schema/tables.ts

export const widgetTable = pgTable(
  "widget",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("widget_organization_id_idx").on(table.organizationId),
    index("widget_is_active_idx").on(table.isActive),
  ]
);
```

### 2. Define Relations

```typescript
// lib/db/schema/relations.ts

export const widgetRelations = relations(widgetTable, ({ one }) => ({
  organization: one(organizationTable, {
    fields: [widgetTable.organizationId],
    references: [organizationTable.id],
  }),
}));

// Add to organization relations
export const organizationRelations = relations(
  organizationTable,
  ({ many }) => ({
    // ... existing relations
    widgets: many(widgetTable),
  })
);
```

### 3. Export

```typescript
// lib/db/schema/index.ts
export * from "./enums";
export * from "./relations";
export * from "./tables"; // widgetTable is auto-exported
```

### 4. Generate Migration

```bash
npm run db:generate
```

### 5. Run Migration

```bash
npm run db:migrate
```

---

## Adding a New Enum

```typescript
// lib/db/schema/enums.ts

export const WidgetType = {
  chart: "chart",
  table: "table",
  metric: "metric",
} as const;

export type WidgetType = (typeof WidgetType)[keyof typeof WidgetType];
export const WidgetTypes = Object.values(WidgetType);
```

Use in table:

```typescript
import { WidgetType, enumToPgEnum } from "./enums";

type: text("type", { enum: enumToPgEnum(WidgetType) })
  .$type<WidgetType>()
  .notNull()
  .default(WidgetType.chart),
```

---

## Type Safety

### Infer Types from Schema

```typescript
// Insert type (what you pass to insert)
type LeadInsert = typeof leadTable.$inferInsert;

// Select type (what you get from queries)
type LeadSelect = typeof leadTable.$inferSelect;
```

### Use in Functions

```typescript
export async function createLead(
  data: typeof leadTable.$inferInsert
): Promise<typeof leadTable.$inferSelect> {
  const [lead] = await db.insert(leadTable).values(data).returning();
  return lead;
}
```

---

## Multi-Tenant Pattern

**Critical**: Always filter by `organizationId` for tenant data.

```typescript
// CORRECT - Data isolated per organization
const leads = await db.query.leadTable.findMany({
  where: eq(leadTable.organizationId, ctx.organization.id),
});

// WRONG - Data leak across tenants!
const leads = await db.query.leadTable.findMany();
```

### Safe Update/Delete

```typescript
// Atomic operation - checks org ownership in same query
const [updated] = await db
  .update(leadTable)
  .set(data)
  .where(
    and(
      eq(leadTable.id, leadId),
      eq(leadTable.organizationId, ctx.organization.id) // Security check
    )
  )
  .returning();

if (!updated) {
  throw new TRPCError({ code: "NOT_FOUND" });
}
```

---

## Migrations

### Commands

| Command               | Description                                   |
| --------------------- | --------------------------------------------- |
| `npm run db:generate` | Generate migration from schema changes        |
| `npm run db:migrate`  | Apply pending migrations                      |
| `npm run db:studio`   | Open Drizzle Studio GUI                       |
| `npm run db:push`     | Push schema directly (dev only, no migration) |

### Migration Workflow

1. **Edit schema** in `lib/db/schema/tables.ts`
2. **Generate migration**: `npm run db:generate`
3. **Review migration** in `lib/db/migrations/`
4. **Apply migration**: `npm run db:migrate`

### Data Migrations

For complex migrations with data transformation, edit the generated SQL:

```sql
-- Add new column
ALTER TABLE "lead" ADD COLUMN "full_name" text;

-- Populate from existing data
UPDATE "lead" SET "full_name" = "first_name" || ' ' || "last_name";

-- Make it required
ALTER TABLE "lead" ALTER COLUMN "full_name" SET NOT NULL;
```

---

## Docker Setup

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: database
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Commands

```bash
npm run docker:up     # Start PostgreSQL
npm run docker:down   # Stop PostgreSQL
```

---

## Production Databases

### Recommended Providers

| Provider                               | Best For                      | Free Tier    |
| -------------------------------------- | ----------------------------- | ------------ |
| [Neon](https://neon.tech)              | Serverless, branching         | 0.5 GB       |
| [Supabase](https://supabase.com)       | Full platform                 | 500 MB       |
| [Railway](https://railway.app)         | Simple setup                  | $5/mo credit |
| [PlanetScale](https://planetscale.com) | Most reliable                 | $5/mo        |

### Connection String Format

```bash
# With SSL (required for most cloud providers)
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

---

## Best Practices

### 1. Always Use Timestamps

```typescript
createdAt: timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow(),
updatedAt: timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date()),
```

### 2. Use Cascade Deletes

```typescript
userId: uuid("user_id")
  .references(() => userTable.id, { onDelete: "cascade" }),
```

### 3. Add Indexes for Queries

```typescript
(table) => [
  index("lead_org_status_idx").on(table.organizationId, table.status),
];
```

### 4. Use Transactions for Related Operations

```typescript
await db.transaction(async (tx) => {
  await tx.delete(...);
  await tx.insert(...);
});
```

### 5. Return Data with `returning()`

```typescript
const [created] = await db.insert(...).returning();
// vs
await db.insert(...);  // No feedback
```

---

## File Reference

| File                         | Purpose                   |
| ---------------------------- | ------------------------- |
| `drizzle.config.ts`          | Drizzle Kit configuration |
| `lib/db/index.ts`            | Main exports              |
| `lib/db/client.ts`           | Database client           |
| `lib/db/schema/tables.ts`    | Table definitions         |
| `lib/db/schema/enums.ts`     | Enum definitions          |
| `lib/db/schema/relations.ts` | Relation definitions      |
| `lib/db/migrations/*.sql`    | Migration files           |
| `docker-compose.yml`         | Local PostgreSQL          |

---

## Environment Variables

| Variable            | Required   | Description                  |
| ------------------- | ---------- | ---------------------------- |
| `DATABASE_URL`      | Yes        | PostgreSQL connection string |
| `POSTGRES_USER`     | For Docker | Database user                |
| `POSTGRES_PASSWORD` | For Docker | Database password            |
| `POSTGRES_DB`       | For Docker | Database name                |
| `POSTGRES_HOST`     | For Docker | Database host                |
| `POSTGRES_PORT`     | For Docker | Database port                |
