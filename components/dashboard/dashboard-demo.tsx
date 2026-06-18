"use client";

import dynamic from "next/dynamic";
import { CenteredSpinner } from "@/components/ui/custom/centered-spinner";

export const DashboardDemo = dynamic(() => import("./dashboard-demo-charts"), {
	ssr: false,
	loading: () => (
		<div className="flex flex-1 flex-col items-center justify-center py-24">
			<CenteredSpinner size="large" />
		</div>
	),
});
