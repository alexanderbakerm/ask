import { headers } from "next/headers";
import { cache } from "react";

export const createTRPCContext = cache(async () => {
	const headersList = await headers();

	return {
		// Include request metadata for logging
		userAgent: headersList.get("user-agent"),
		ip: headersList.get("x-forwarded-for") || headersList.get("x-real-ip"),
		requestId: headersList.get("x-request-id"),
	};
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
