"use client";

import { ChevronLeftIcon, HomeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NotFound() {
	const goBack = () => {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = "/";
		}
	};

	const goHome = () => {
		window.location.href = "/";
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-marketing-bg px-6 py-16">
			<div className="w-full max-w-lg text-center">
				<p className="text-sm font-semibold text-marketing-fg-subtle">
					Page not found
				</p>

				<h1
					className={cn(
						"mt-4 font-display text-[5rem] leading-20 tracking-tight",
						"text-marketing-fg",
					)}
				>
					404
				</h1>

				<p className="mx-auto mt-4 max-w-md text-base leading-7 text-marketing-fg-muted">
					Sorry, the page you are looking for doesn&apos;t exist or has been
					moved.
				</p>

				<div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
					<button
						type="button"
						onClick={goBack}
						className={cn(
							"inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
							"bg-marketing-accent text-marketing-accent-fg hover:bg-marketing-accent-hover",
						)}
					>
						<ChevronLeftIcon className="size-4" />
						Go back
					</button>
					<button
						type="button"
						onClick={goHome}
						className={cn(
							"inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
							"text-marketing-fg hover:bg-marketing-card-hover",
							"dark:hover:bg-white/10",
						)}
					>
						<HomeIcon className="size-4" />
						Back to Home
					</button>
				</div>
			</div>
		</div>
	);
}
