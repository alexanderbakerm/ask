import type { ReactNode } from "react";
import { CookieBanner } from "@/components/marketing/navigation/cookie-banner";
import { Footer } from "@/components/marketing/navigation/footer";
import { Header } from "@/components/marketing/navigation/header";
import { ThemeToggle } from "@/components/ui/custom/theme-toggle";
import { MarketingProviders } from "./providers";

/**
 * Marketing Layout
 * Wraps all public/marketing pages with marketing-specific providers.
 * Lighter weight than SaaS - no auth/organization context.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
	return (
		<MarketingProviders>
			<div className="bg-marketing-bg text-marketing-fg font-display-headings">
				<Header />
				<main className="min-h-screen">{children}</main>
				<Footer />
			</div>
			<ThemeToggle className="fixed right-4 bottom-4 z-50 rounded-full" />
			<CookieBanner />
		</MarketingProviders>
	);
}
