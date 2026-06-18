import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type * as React from "react";

import "./globals.css";
import "cropperjs/dist/cropper.css";

import { SessionProvider } from "@/components/session-provider";
import { appConfig } from "@/config/app.config";
import { getSession } from "@/lib/auth/server";
import { TRPCProvider } from "@/trpc/client";

export const metadata: Metadata = {
	metadataBase: new URL(appConfig.baseUrl),
	title: {
		absolute: appConfig.appName,
		default: appConfig.appName,
		template: `%s | ${appConfig.appName}`,
	},
	description: appConfig.description,
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: appConfig.appName,
		title: appConfig.appName,
		description: appConfig.description,
		images: [
			{
				url: "/og-image",
				width: 1200,
				height: 630,
				alt: appConfig.appName,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: appConfig.appName,
		description: appConfig.description,
		images: ["/og-image"],
	},
	robots: {
		index: true,
		follow: true,
	},
};

/**
 * Root Layout
 * Minimal layout that handles:
 * - HTML structure and fonts
 * - Global metadata and SEO
 * - Vercel Analytics and Speed Insights
 * - Global tRPC and React Query provider
 * - Global Session context provider
 */
export default async function RootLayout({
	children,
}: React.PropsWithChildren): Promise<React.JSX.Element> {
	const session = await getSession();

	return (
		<html
			className={`${GeistSans.variable} size-full min-h-screen`}
			lang="en"
			suppressHydrationWarning
		>
			<head />
			<body className="size-full min-h-screen bg-background text-foreground antialiased">
				<TRPCProvider
					organizationId={
						session ? (session.session.activeOrganizationId ?? null) : undefined
					}
				>
					<SessionProvider initialSession={session}>{children}</SessionProvider>
				</TRPCProvider>
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}
