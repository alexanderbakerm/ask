"use client";

import { usePathname, useRouter } from "next/navigation";
import NProgress from "nprogress";
import * as React from "react";

export function useProgressRouter() {
	const router = useRouter();
	const pathname = usePathname();

	React.useEffect(() => {
		NProgress.done();
	}, [pathname]);

	const replace = React.useCallback(
		(href: string, options?: Parameters<typeof router.replace>[1]) => {
			href !== pathname && NProgress.start();
			router.replace(href, options);
		},
		[router, pathname],
	);

	const push = React.useCallback(
		(href: string, options?: Parameters<typeof router.push>[1]) => {
			href !== pathname && NProgress.start();
			router.push(href, options);
		},
		[router, pathname],
	);

	return {
		...router,
		replace,
		push,
	};
}
