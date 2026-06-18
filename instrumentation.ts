import { captureRequestError } from "@sentry/nextjs";

export async function register(): Promise<void> {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./instrumentation-server");
	}
	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./instrumentation-edge");
	}
}

export const onRequestError = captureRequestError;
