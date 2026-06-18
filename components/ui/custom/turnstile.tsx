"use client";

import {
	type TurnstileInstance,
	Turnstile as TurnstileWidget,
} from "@marsidev/react-turnstile";
import { useTheme } from "next-themes";
import * as React from "react";
import { env } from "@/lib/env";

export type TurnstileRef = TurnstileInstance;

type TurnstileProps = {
	onSuccess: (token: string) => void;
	onError?: () => void;
	onExpire?: () => void;
};

export const TurnstileCaptcha = React.forwardRef<TurnstileRef, TurnstileProps>(
	({ onSuccess, onError, onExpire }, ref) => {
		const { resolvedTheme } = useTheme();
		const [mounted, setMounted] = React.useState(false);
		const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

		React.useEffect(() => {
			setMounted(true);
		}, []);

		if (!siteKey) {
			return null;
		}

		// Show placeholder until mounted to avoid hydration mismatch
		// (resolvedTheme is undefined during SSR)
		if (!mounted) {
			return (
				<div
					className="h-[65px] w-[300px] animate-pulse rounded bg-muted"
					aria-hidden="true"
				/>
			);
		}

		return (
			<TurnstileWidget
				ref={ref}
				siteKey={siteKey}
				options={{
					theme: resolvedTheme === "dark" ? "dark" : "light",
				}}
				onSuccess={onSuccess}
				onError={onError}
				onExpire={onExpire}
			/>
		);
	},
);

TurnstileCaptcha.displayName = "TurnstileCaptcha";
