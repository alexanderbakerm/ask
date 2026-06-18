import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/logo";

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: (
				<div className="flex items-center gap-2">
					<Logo />
				</div>
			),
			url: "/",
		},
		links: [],
	};
}
