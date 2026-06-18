import Link from "next/link";
import type * as React from "react";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OnboardingLayout({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	return (
		<div className="bg-marketing-bg text-marketing-fg font-display-headings">
			<main className="isolate min-h-screen overflow-clip">
				<div className="mx-auto flex w-full min-w-[320px] max-w-md flex-col items-center gap-8 pt-8 pb-24 px-6 sm:pt-12 sm:pb-32">
					<Link href="/" className="inline-flex">
						<Logo className="h-10 w-auto" />
					</Link>
					<div className="w-full space-y-8">{children}</div>
				</div>
			</main>
		</div>
	);
}
