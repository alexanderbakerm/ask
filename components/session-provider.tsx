"use client";

import type * as React from "react";
import { SessionContext } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";
import { trpc } from "@/trpc/client";
import type { Session } from "@/types/session";

export function SessionProvider({
	children,
	initialSession,
}: React.PropsWithChildren<{
	initialSession?: Session | null;
}>): React.JSX.Element {
	const utils = trpc.useUtils();
	const { data: session, isFetched } = trpc.user.getSession.useQuery(
		undefined,
		{
			initialData: initialSession ?? undefined,
		},
	);

	const loaded = isFetched || initialSession !== undefined;

	return (
		<SessionContext.Provider
			value={{
				loaded,
				session: session?.session ?? null,
				user: session?.user ?? null,
				reloadSession: async () => {
					const { data: newSession, error } = await authClient.getSession({
						query: {
							disableCookieCache: true,
						},
					});
					if (error) {
						throw new Error(error.message || "Failed to fetch session");
					}
					utils.user.getSession.setData(undefined, () => newSession);
				},
			}}
		>
			{children}
		</SessionContext.Provider>
	);
}
