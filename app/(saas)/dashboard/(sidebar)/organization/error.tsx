"use client";

import { captureException } from "@sentry/nextjs";
import * as React from "react";
import { ErrorPage } from "@/components/error-page";

/**
 * Catches errors in organization pages (dashboard, data sources, etc.) without
 * unmounting the sidebar layout — only the main content area shows the error.
 */
export default function OrganizationErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}): React.JSX.Element {
	React.useEffect(() => {
		captureException(error);
	}, [error]);

	return <ErrorPage error={error} reset={reset} />;
}
