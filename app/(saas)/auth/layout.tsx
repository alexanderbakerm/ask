import type * as React from "react";
import { ThemeToggle } from "@/components/ui/custom/theme-toggle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthLayout({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	return (
		<main className="min-h-[100dvh] bg-background">
			{children}
			<ThemeToggle className="fixed right-2 bottom-2 z-50 rounded-full" />
		</main>
	);
}
