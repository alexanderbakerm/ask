"use client";

import NiceModal from "@ebay/nice-modal-react";
import { RootProvider } from "fumadocs-ui/provider/next";
import NextTopLoader from "nextjs-toploader";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appConfig } from "@/config/app.config";
import { ThemeProvider } from "@/hooks/use-theme";

/**
 * Marketing-specific providers.
 * Lighter weight than SaaS providers - no auth/session context needed.
 * Includes TRPC for public API calls like contact form.
 */
export function MarketingProviders({
	children,
}: React.PropsWithChildren): React.JSX.Element {
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
					<NiceModal.Provider>
						<RootProvider>{children}</RootProvider>
					</NiceModal.Provider>
				</TooltipProvider>
			</ThemeProvider>
			<Toaster position="top-right" />
		</NuqsAdapter>
	);
}
