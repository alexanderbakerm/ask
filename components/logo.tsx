import type * as React from "react";
import { appConfig } from "@/config/app.config";
import { cn } from "@/lib/utils";

export type LogoProps = {
	className?: string;
	withLabel?: boolean;
};

export function Logo({
	withLabel = true,
	className,
}: LogoProps): React.JSX.Element {
	return (
		<span
			className={cn(
				"flex items-center font-semibold text-foreground leading-none",
				className,
			)}
		>
			<div className="flex size-9 items-center justify-center p-1">
				<div className="flex size-7 items-center justify-center rounded-md border bg-primary text-primary-foreground">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<g>
							<path
								d="M7.81815 8.36373L12 0L24 24H15.2809L7.81815 8.36373Z"
								fill="currentColor"
							/>
							<path
								d="M4.32142 15.3572L8.44635 24H-1.14809e-06L4.32142 15.3572Z"
								fill="currentColor"
							/>
						</g>
					</svg>
				</div>
			</div>
			{withLabel && (
				<span className="ml-2 hidden font-bold text-lg md:block">
					{appConfig.appName}
				</span>
			)}
		</span>
	);
}
