import type * as React from "react";
import { AuthThemeProvider } from "@/components/auth/auth-theme-provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthLayout({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	return (
		<AuthThemeProvider>
			<main className="min-h-[100dvh] bg-background">{children}</main>
		</AuthThemeProvider>
	);
}
