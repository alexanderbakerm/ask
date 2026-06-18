import Link from "next/link";
import type * as React from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/ui/custom/theme-toggle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthLayout({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	return (
		<main className="h-screen bg-neutral-50 px-4 dark:bg-background">
			<div className="mx-auto w-full min-w-[320px] max-w-sm space-y-6 py-12">
				<Link className="mx-auto block w-fit" href="/">
					<Logo />
				</Link>
				{children}
			</div>
			<ThemeToggle className="fixed right-2 bottom-2 rounded-full" />
		</main>
	);
}
