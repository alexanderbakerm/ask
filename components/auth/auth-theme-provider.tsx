"use client";

import type * as React from "react";
import { ThemeProvider } from "@/hooks/use-theme";

/**
 * Auth routes always render in light mode so sign-in/sign-up stay readable
 * regardless of the user's system or dashboard theme preference.
 */
export function AuthThemeProvider({
	children,
}: React.PropsWithChildren): React.JSX.Element {
	return (
		<ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
			{children}
		</ThemeProvider>
	);
}
