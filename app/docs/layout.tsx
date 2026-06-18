import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/marketing/docs/layout.config";
import { source } from "@/lib/marketing/docs/source";

export default function DocsRootLayout({ children }: { children: ReactNode }) {
	return (
		<RootProvider>
			<DocsLayout
				{...baseOptions()}
				tree={source.pageTree}
				sidebar={{
					defaultOpenLevel: 1,
					tabs: false,
				}}
			>
				{children}
			</DocsLayout>
		</RootProvider>
	);
}
