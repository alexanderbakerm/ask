"use client";

import { captureException } from "@sentry/nextjs";
import * as React from "react";
import { ErrorPage } from "@/components/error-page";

export default function AppErrorPage({
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
