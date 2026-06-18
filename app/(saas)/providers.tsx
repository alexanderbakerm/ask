"use client";

import NiceModal from "@ebay/nice-modal-react";
import NextTopLoader from "nextjs-toploader";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appConfig } from "@/config/app.config";
import { ThemeProvider } from "@/hooks/use-theme";

interface SaaSProvidersProps extends React.PropsWithChildren {}

/**
 * SaaS-specific providers.
 * Full-featured with auth, organization context, and TRPC integration.
 */
export function SaaSProviders({
	children,
}: SaaSProvidersProps): React.JSX.Element {
	return (
		<NuqsAdapter>
			<NextTopLoader color="var(--color-primary)" />
			<ThemeProvider
				attribute="class"
				defaultTheme={appConfig.theme.default}
				disableTransitionOnChange
				enableSystem
				themes={[...appConfig.theme.available]}
			>
				<TooltipProvider>
					<NiceModal.Provider>{children}</NiceModal.Provider>
				</TooltipProvider>
			</ThemeProvider>
			<Toaster position="top-right" />
		</NuqsAdapter>
	);
}
