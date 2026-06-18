import {
	captureRouterTransitionStart,
	init,
	replayIntegration,
} from "@sentry/nextjs";

const enableSentry = process.env.NODE_ENV !== "development";

if (enableSentry && process.env.NEXT_PUBLIC_SENTRY_DSN) {
	init({
		dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
		environment: process.env.NODE_ENV,

		tracesSampleRate: 0.1,
		maxBreadcrumbs: 30,

		initialScope: {
			tags: {
				runtime: "browser",
			},
		},

		sendDefaultPii: false,

		integrations: [replayIntegration()],

		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,

		beforeSend: (event) => {
			const exception = event.exception?.values?.[0];

			// Filter out chunk loading errors
			if (
				exception?.type === "ChunkLoadError" ||
				exception?.value?.includes("Loading chunk") ||
				exception?.value?.includes("Loading CSS chunk")
			) {
				return null;
			}

			// Filter out network errors
			if (
				exception?.type === "TypeError" &&
				(exception?.value?.includes("Failed to fetch") ||
					exception?.value?.includes("NetworkError") ||
					exception?.value?.includes("Load failed"))
			) {
				return null;
			}

			// Filter out ResizeObserver errors
			if (
				exception?.type === "ResizeObserver" ||
				exception?.value?.includes("ResizeObserver loop limit exceeded")
			) {
				return null;
			}

			// Filter out browser extension errors
			if (
				exception?.value?.includes("chrome-extension://") ||
				exception?.value?.includes("moz-extension://") ||
				exception?.value?.includes("safari-extension://")
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

			// Filter out noisy navigation breadcrumbs
			if (
				breadcrumb.category === "navigation" &&
				breadcrumb.data?.from === breadcrumb.data?.to
			) {
				return null;
			}

			return breadcrumb;
		},
	});
}

export const onRouterTransitionStart = captureRouterTransitionStart;
