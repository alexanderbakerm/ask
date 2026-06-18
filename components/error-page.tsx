"use client";

import { ChevronLeftIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export function ErrorPage({ error, reset }: ErrorPageProps) {
	const [copied, setCopied] = React.useState(false);

	const goBack = () => {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = "/";
		}
	};

	const copyErrorDetails = () => {
		const details = [
			`Error: ${error.message}`,
			error.digest ? `Digest: ${error.digest}` : null,
			`Timestamp: ${new Date().toISOString()}`,
			`URL: ${typeof window !== "undefined" ? window.location.href : ""}`,
		]
			.filter(Boolean)
			.join("\n");

		navigator.clipboard.writeText(details);
		setCopied(true);
	};

	// Clear "copied" state after timeout with proper cleanup
	React.useEffect(() => {
		if (!copied) return;
		const timeoutId = setTimeout(() => setCopied(false), 2000);
		return () => clearTimeout(timeoutId);
	}, [copied]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-marketing-bg px-6 py-16">
			<div className="w-full max-w-lg text-center">
				<p className="text-sm font-semibold text-marketing-fg-subtle">
					Something went wrong
				</p>

				<h1
					className={cn(
						"mt-4 font-display text-[2rem] leading-10 tracking-tight",
						"text-marketing-fg",
						"sm:text-5xl sm:leading-14",
					)}
				>
					Application Error
				</h1>

				<p className="mx-auto mt-4 max-w-md text-base leading-7 text-marketing-fg-muted">
					An unexpected error occurred while processing your request. You can
					try again or go back to the previous page.
				</p>

				<div className="mt-8 rounded-xl bg-marketing-card p-6 text-left">
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0 flex-1">
							<p className="text-sm font-semibold text-marketing-fg">
								Error message
							</p>
							<p className="mt-1 wrap-break-word font-mono text-sm text-marketing-fg-muted">
								{error.message || "An unknown error occurred"}
							</p>
						</div>
						<button
							type="button"
							onClick={copyErrorDetails}
							className={cn(
								"inline-flex shrink-0 items-center justify-center rounded-full p-2",
								"text-marketing-fg hover:bg-marketing-card-hover",
								"dark:hover:bg-white/10",
							)}
						>
							<CopyIcon className="size-4" />
							<span className="sr-only">Copy error details</span>
						</button>
					</div>
					{error.digest && (
						<div className="mt-4 border-t border-marketing-border pt-4">
							<p className="text-sm font-semibold text-marketing-fg">
								Error ID
							</p>
							<p className="mt-1 font-mono text-xs text-marketing-fg-muted">
								{error.digest}
							</p>
						</div>
					)}
					{copied && (
						<p className="mt-4 text-xs text-marketing-fg-subtle">
							Error details copied to clipboard
						</p>
					)}
				</div>

				<div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
					<button
						type="button"
						onClick={reset}
						className={cn(
							"inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
							"bg-marketing-accent text-marketing-accent-fg hover:bg-marketing-accent-hover",
						)}
					>
						<RefreshCwIcon className="size-4" />
						Try again
					</button>
					<button
						type="button"
						onClick={goBack}
						className={cn(
							"inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
							"text-marketing-fg hover:bg-marketing-card-hover",
							"dark:hover:bg-white/10",
						)}
					>
						<ChevronLeftIcon className="size-4" />
						Go back
					</button>
				</div>
			</div>
		</div>
	);
}
