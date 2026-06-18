import type * as React from "react";
import { appConfig } from "@/config/app.config";
import { cn } from "@/lib/utils";

export type LogoProps = {
	className?: string;
	withLabel?: boolean;
};

function AskBiIcon({ className }: { className?: string }): React.JSX.Element {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden="true"
		>
			<path
				d="M23.4212 8.82456C22.2976 8.62021 21.588 8.80745 20.6199 9.45155C19.5435 10.1653 18.9218 11.2215 18.4814 12.3889C18.1074 13.3793 17.9613 14.4207 17.893 15.4754C17.8489 16.0612 17.7819 16.6631 17.6599 17.2355C17.5578 17.6911 17.2393 17.8892 16.7711 17.8371C16.6154 17.8104 16.4544 17.7668 16.2994 17.7122C15.1879 17.2734 14.4518 16.3978 13.8533 15.3973C13.1815 14.2159 12.6856 12.9444 12.3815 11.6055C11.9056 9.6077 11.4746 7.60559 11.0943 5.58812C10.8899 4.48674 10.622 3.66313 10.2092 2.81876C9.89183 2.16708 9.46191 1.54026 8.89978 0.842695C8.47036 0.400365 8.28768 0.132567 7.70709 -0.504013C5.98886 0.376523 4.89507 1.52029 4.36945 2.1319C3.71645 2.90211 2.8607 4.13072 2.32266 5.79858C1.57135 8.10344 1.80176 10.0832 1.97104 11.0383C2.14032 11.9933 2.5901 13.722 3.84988 15.4731C4.38843 16.2147 5.81503 17.9984 8.37892 19.0867C10.3793 19.9302 12.1669 19.9796 13.1858 19.9295C14.8375 19.8354 16.1245 19.3901 16.843 19.0801C18.2007 18.5027 19.1999 17.7477 19.8534 17.162C20.8623 16.2562 21.5486 15.2913 22.001 14.4987C22.7827 13.1171 23.0967 11.868 23.2344 11.1338C23.3372 10.6503 23.4493 9.83162 23.4212 8.82456Z"
				fill="currentColor"
			/>
		</svg>
	);
}

export function Logo({
	withLabel = true,
	className,
}: LogoProps): React.JSX.Element {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2.5 font-semibold text-foreground leading-none",
				className,
			)}
		>
			<AskBiIcon className="size-6 shrink-0" />
			{withLabel ? (
				<span className="text-lg font-semibold tracking-tight">
					{appConfig.appName}
				</span>
			) : null}
		</span>
	);
}
