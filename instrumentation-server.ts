import { init } from "@sentry/nextjs";
import { env } from "@/lib/env";

const enableSentry = process.env.NODE_ENV !== "development";

if (enableSentry && env.NEXT_PUBLIC_SENTRY_DSN) {
	init({
		dsn: env.NEXT_PUBLIC_SENTRY_DSN,
		environment: process.env.NODE_ENV,

		tracesSampleRate: 0.1,
		maxBreadcrumbs: 50,

		initialScope: {
			tags: {
				runtime: "server",
			},
		},

		sendDefaultPii: true,

		beforeSend: (event) => {
			const exception = event.exception?.values?.[0];

			// Filter out TRPCError NOT_FOUND
			if (
				exception?.type === "TRPCError" &&
				exception.value?.includes("NOT_FOUND")
			) {
				return null;
			}

			// Filter out chunk loading errors
			if (
				exception?.type === "ChunkLoadError" ||
				exception?.value?.includes("Loading chunk")
			) {
				return null;
			}

			// Filter out network errors
			if (
				exception?.type === "TypeError" &&
				(exception?.value?.includes("Failed to fetch") ||
					exception?.value?.includes("NetworkError"))
			) {
				return null;
			}

			return event;
		},

		beforeBreadcrumb: (breadcrumb) => {
			// Don't capture console.log as breadcrumbs in production
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
