import { init } from "@sentry/nextjs";
import { env } from "@/lib/env";

const enableSentry = process.env.NODE_ENV !== "development";

if (enableSentry && env.NEXT_PUBLIC_SENTRY_DSN) {
	init({
		dsn: env.NEXT_PUBLIC_SENTRY_DSN,
		environment: process.env.NODE_ENV,

		tracesSampleRate: 0.1,
		maxBreadcrumbs: 30,

		initialScope: {
			tags: {
				runtime: "edge",
			},
		},

		sendDefaultPii: false,

		beforeSend: (event) => {
			const exception = event.exception?.values?.[0];

			// Filter out TRPCError NOT_FOUND
			if (
				exception?.type === "TRPCError" &&
				exception.value?.includes("NOT_FOUND")
			) {
				return null;
			}

			// Filter out edge-specific errors
			if (
				exception?.value?.includes("Dynamic Code Evaluation") ||
				exception?.value?.includes("eval is not allowed")
			) {
				return null;
			}

			return event;
		},

		beforeBreadcrumb: (breadcrumb) => {
			if (
				process.env.NODE_ENV === "production" &&
				breadcrumb.category === "console"
			) {
				return null;
			}
			return breadcrumb;
		},
	});
}
