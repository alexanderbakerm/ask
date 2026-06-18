import type * as React from "react";
import { ImpersonationBanner } from "@/components/user/impersonate-banner";
import { SaaSProviders } from "./providers";

/**
 * SaaS Layout
 * Wraps all authenticated/dashboard pages with SaaS-specific providers.
 * Includes session-aware TRPC and organization context.
 */
export default function SaaSLayout({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	return (
		<SaaSProviders>
			{children}
			<ImpersonationBanner />
		</SaaSProviders>
	);
}
