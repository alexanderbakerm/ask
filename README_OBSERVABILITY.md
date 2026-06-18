# Observability

This template includes comprehensive monitoring with **Sentry** for error tracking and performance monitoring, a custom **Pino-based logger** for structured logging and **Vercel Analytics** for usage insights.

---

## Quick Setup

### 1. Set Up Sentry

1. Create account at [sentry.io](https://sentry.io)
2. Create a new Next.js project
3. Get your DSN from project settings
4. Create an auth token (Settings → Auth Tokens)

```bash
# .env
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="sntrys_xxxxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx.ingest.sentry.io/xxxxx"
```

### 2. Enable Vercel Analytics

1. Go to Vercel Dashboard → Your Project
2. Click **Analytics** tab → **Enable**
3. Click **Speed Insights** tab → **Enable**

No environment variables needed - automatically configured on Vercel.

That's it! Monitoring is now active.

---

## Sentry Features

### Error Tracking

Errors are automatically captured across:
- **Client-side**: Browser errors, React errors
- **Server-side**: API routes, Server Components, tRPC procedures
- **Edge runtime**: Middleware, edge functions

### Performance Monitoring

- 30% of transactions are traced (configurable)
- Automatic instrumentation of:
  - Page loads
  - API calls
  - Database queries
  - tRPC procedures

### Session Replay

- 10% of sessions recorded normally
- 100% of sessions with errors recorded
- Helps debug user-reported issues

### Source Maps

Uploaded automatically on Vercel/CI deployments for readable stack traces.

---

## Logger System

### Basic Usage

```typescript
import { logger } from "@/lib/logger";

// Simple message
logger.info("Server started");

// With context (object FIRST, message SECOND)
logger.info({ userId, action: "login" }, "User logged in");

// Error logging
logger.error({ error: err.message, userId }, "Failed to process payment");
```

### Named Loggers

Create loggers with semantic group names for easier filtering:

```typescript
import { LoggerFactory } from "@/lib/logger/factory";

const logger = LoggerFactory.getLogger("Billing");

logger.info({ subscriptionId }, "Subscription created");
logger.error({ error }, "Payment failed");
```

### Available Log Levels

| Level | Method | Use Case |
|-------|--------|----------|
| `trace` | `logger.trace()` | Very detailed debugging |
| `debug` | `logger.debug()` | Development debugging |
| `info` | `logger.info()` | General information |
| `warn` | `logger.warn()` | Warning conditions |
| `error` | `logger.error()` | Error conditions |
| `fatal` | `logger.fatal()` | System is unusable |

### Predefined Logger Groups

These groups have predefined colors in the console:

| Group | Color | Use For |
|-------|-------|---------|
| `Billing` | Magenta | Payment/subscription logic |
| `Auth` | Blue | Authentication logic |
| `Webhook` | Magenta | Webhook handlers |
| `Database` | Yellow | Database operations |
| `API` | Green | API endpoints |
| `Organization` | Cyan | Organization logic |
| `User` | Yellow | User management |
| `Email` | Blue | Email sending |
| `Storage` | Green | File storage |

### Development vs Production

**Development**:
- Pretty-printed, colorized output
- Human-readable format
- All log levels visible

**Production**:
- JSON format (for log aggregation)
- Structured for parsing
- Default level: `info`

Configure log level:
```bash
NEXT_PUBLIC_LOG_LEVEL="debug"  # trace, debug, info, warn, error, fatal
```

---

## Error Filtering

Sentry automatically filters common non-actionable errors:

### Client-Side Filters

| Error Type | Reason |
|------------|--------|
| ChunkLoadError | Network issues, user navigation |
| Failed to fetch | Network connectivity |
| ResizeObserver loop | Browser quirk, not a bug |
| Browser extensions | Third-party code |

### Server-Side Filters

| Error Type | Reason |
|------------|--------|
| TRPCError NOT_FOUND | Expected 404s |
| Network errors | Transient connectivity |

### Breadcrumb Filtering

- Console logs excluded in production (reduces noise)
- Same-page navigation events excluded

---

## tRPC Integration

All tRPC procedures are automatically instrumented:

### What's Captured

- Procedure name and type (query/mutation)
- User ID and email
- Organization ID
- Impersonation status
- Request metadata (IP, User-Agent)
- Execution duration
- Error details

### Sentry Context

```typescript
// Automatically set for each procedure
scope.setUser({ id: userId, email });
scope.setContext("trpc", {
  procedure: "organization.leads.create",
  type: "mutation",
  organizationId: "...",
});
scope.setTag("procedure", "organization.leads.create");
```

---

## Error Boundaries

### App Error Boundary

Catches errors in the app (not root layout):

```typescript
// app/error.tsx
"use client";

export default function AppErrorPage({ error, reset }) {
  useEffect(() => {
    captureException(error);  // Sent to Sentry
  }, [error]);

  return <ErrorPage error={error} reset={reset} />;
}
```

### Global Error Boundary

Catches errors in the root layout:

```typescript
// app/global-error.tsx
"use client";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <ErrorPage error={error} reset={reset} />
      </body>
    </html>
  );
}
```

---

## Custom Instrumentation

### Add Custom Sentry Context

```typescript
import * as Sentry from "@sentry/nextjs";

// Add a tag (for filtering in Sentry UI)
Sentry.setTag("feature", "checkout");

// Add context (detailed data attached to errors)
Sentry.setContext("order", {
  orderId: "123",
  amount: 9900,
  currency: "usd",
});

// Add breadcrumb (trail of events before error)
Sentry.addBreadcrumb({
  category: "checkout",
  message: "User clicked checkout",
  level: "info",
});
```

### Capture Custom Errors

```typescript
import { captureException, captureMessage } from "@sentry/nextjs";

// Capture an exception
try {
  riskyOperation();
} catch (error) {
  captureException(error);
}

// Capture a message (non-error event)
captureMessage("User exported data", "info");
```

### Request Context for Logging

Server-side logging can include request context:

```typescript
import { runWithRequestContext } from "@/lib/logger/server";

// In an API route or server action
await runWithRequestContext(
  {
    userId: session.user.id,
    requestId: headers.get("x-request-id"),
    endpoint: "/api/checkout",
  },
  async () => {
    // All logger calls automatically include this context
    logger.info("Processing checkout");  // Includes userId, requestId, endpoint
  }
);
```

---

## Vercel Analytics

### Web Analytics

Tracks:
- Page views
- Unique visitors
- Top pages
- Referrers
- Countries
- Devices

### Speed Insights

Tracks Core Web Vitals:
- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay)
- **CLS** (Cumulative Layout Shift)
- **TTFB** (Time to First Byte)
- **FCP** (First Contentful Paint)

### Components

Already added in `app/layout.tsx`:

```typescript
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

---

## Configuration Reference

### Sentry Sample Rates

| Setting | Value | Meaning |
|---------|-------|---------|
| `tracesSampleRate` | 0.3 | 30% of transactions traced |
| `replaysSessionSampleRate` | 0.1 | 10% of sessions recorded |
| `replaysOnErrorSampleRate` | 1.0 | 100% of error sessions recorded |

Adjust in instrumentation files for cost/coverage balance.

### Runtime-Specific Settings

| Setting | Client | Server | Edge |
|---------|--------|--------|------|
| Max Breadcrumbs | 30 | 50 | 30 |
| Send PII | No | Yes | No |
| Runtime Tag | browser | server | edge |

---

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN**: Verify `NEXT_PUBLIC_SENTRY_DSN` is set
2. **Check environment**: Sentry is disabled in development by default
3. **Check filters**: Error may be filtered (see Error Filtering section)
4. **Check sample rate**: Not all events are captured (30% default)

### Source Maps Not Working

1. Verify Sentry environment variables are set:
   - `SENTRY_ORG`
   - `SENTRY_PROJECT`
   - `SENTRY_AUTH_TOKEN`
2. Deploy to Vercel (source maps only upload in CI)
3. Check Sentry project settings for source map uploads

### Logs Not Showing

1. Check log level: `NEXT_PUBLIC_LOG_LEVEL`
2. In production, logs are JSON format - use a log viewer
3. Server logs appear in terminal/Vercel logs, not browser console

### Vercel Analytics Empty

1. Verify Analytics is enabled in Vercel Dashboard
2. Check that `<Analytics />` component is in layout
3. Wait a few minutes for data to populate

---

## Best Practices

### Structured Logging

```typescript
// Good - object first, message second
logger.info({ userId, action: "login" }, "User logged in");

// Bad - loses structure
logger.info(`User ${userId} logged in`);
```

### Error Context

```typescript
// Good - include relevant context
logger.error({
  error: err.message,
  stack: err.stack,
  userId,
  orderId,
  amount,
}, "Payment processing failed");

// Bad - minimal context
logger.error("Payment failed");
```

### Named Loggers

```typescript
// Good - semantic grouping
const logger = LoggerFactory.getLogger("Billing");
logger.info({ subscriptionId }, "Created subscription");

// OK for simple cases
import { logger } from "@/lib/logger";
logger.info("Server started");
```

### Don't Log Sensitive Data

```typescript
// Bad - logging password
logger.info({ email, password }, "Login attempt");

// Good - omit sensitive fields
logger.info({ email }, "Login attempt");
```

---

## File Reference

| File | Purpose |
|------|---------|
| `instrumentation.ts` | Entry point for instrumentation |
| `instrumentation-client.ts` | Client-side Sentry config |
| `instrumentation-server.ts` | Server-side Sentry config |
| `instrumentation-edge.ts` | Edge runtime Sentry config |
| `lib/logger/index.ts` | Logger export |
| `lib/logger/logger.ts` | Core Logger class |
| `lib/logger/factory.ts` | LoggerFactory singleton |
| `lib/logger/context.ts` | Request context (AsyncLocalStorage) |
| `app/error.tsx` | App error boundary |
| `app/global-error.tsx` | Global error boundary |
| `app/layout.tsx` | Analytics components |
| `next.config.ts` | Sentry build configuration |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SENTRY_ORG` | For Sentry | Organization slug |
| `SENTRY_PROJECT` | For Sentry | Project name |
| `SENTRY_AUTH_TOKEN` | For Sentry | Auth token for source maps |
| `NEXT_PUBLIC_SENTRY_DSN` | For Sentry | Data Source Name |
| `NEXT_PUBLIC_LOG_LEVEL` | No | Log level (default: info) |
