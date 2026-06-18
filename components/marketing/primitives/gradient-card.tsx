"use client";

import type { ReactNode } from "react";
import { NoiseOverlay } from "@/components/marketing/primitives/noise-overlay";
import { cn } from "@/lib/utils";

type GradientColor = "green" | "blue" | "purple" | "brown" | "slate";

type Placement =
	| "bottom"
	| "bottom-left"
	| "bottom-right"
	| "top"
	| "top-left"
	| "top-right";

interface GradientCardProps {
	color?: GradientColor;
	placement?: Placement;
	className?: string;
	children: ReactNode;
	rounded?: "sm" | "md" | "lg" | "xl" | "2xl";
}

// Gradient colors for light and dark modes
const gradientColors: Record<
	GradientColor,
	{ light: { from: string; to: string }; dark: { from: string; to: string } }
> = {
	green: {
		light: { from: "#9ca88f", to: "#596352" },
		dark: { from: "#333a2b", to: "#26361b" },
	},
	blue: {
		light: { from: "#637c86", to: "#778599" },
		dark: { from: "#243a42", to: "#232f40" },
	},
	purple: {
		light: { from: "#7b627d", to: "#8f6976" },
		dark: { from: "#412c42", to: "#3c1a26" },
	},
	brown: {
		light: { from: "#8d7359", to: "#765959" },
		dark: { from: "#382d23", to: "#3d2323" },
	},
	slate: {
		light: { from: "#e2e8f0", to: "#cbd5e1" },
		dark: { from: "#1e293b", to: "#0f172a" },
	},
};

// Padding styles based on placement
const placementStyles: Record<Placement, string> = {
	bottom: "pt-[var(--padding)] px-[var(--padding)]",
	"bottom-left": "pt-[var(--padding)] pr-[var(--padding)]",
	"bottom-right": "pt-[var(--padding)] pl-[var(--padding)]",
	top: "pb-[var(--padding)] px-[var(--padding)]",
	"top-left": "pb-[var(--padding)] pr-[var(--padding)]",
	"top-right": "pb-[var(--padding)] pl-[var(--padding)]",
};

// Inner rounded corners based on placement
const innerRoundedStyles: Record<Placement, string> = {
	bottom: "rounded-t-sm",
	"bottom-left": "rounded-tr-sm",
	"bottom-right": "rounded-tl-sm",
	top: "rounded-b-sm",
	"top-left": "rounded-br-sm",
	"top-right": "rounded-bl-sm",
};

const roundedStyles = {
	sm: "rounded-sm",
	md: "rounded-md",
	lg: "rounded-lg",
	xl: "rounded-xl",
	"2xl": "rounded-2xl",
};

export function GradientCard({
	color = "slate",
	placement = "bottom",
	className,
	children,
	rounded = "lg",
}: GradientCardProps) {
	const colors = gradientColors[color];

	return (
		<div
			className={cn(
				"relative overflow-hidden bg-linear-to-b",
				roundedStyles[rounded],
				className,
			)}
			style={
				{
					"--padding": "min(10%, 4rem)",
					"--gradient-from-light": colors.light.from,
					"--gradient-to-light": colors.light.to,
					"--gradient-from-dark": colors.dark.from,
					"--gradient-to-dark": colors.dark.to,
				} as React.CSSProperties
			}
		>
			{/* Light mode gradient */}
			<div
				className="absolute inset-0 dark:hidden"
				style={{
					background: `linear-gradient(to bottom, ${colors.light.from}, ${colors.light.to})`,
				}}
			/>
			{/* Dark mode gradient */}
			<div
				className="absolute inset-0 hidden dark:block"
				style={{
					background: `linear-gradient(to bottom, ${colors.dark.from}, ${colors.dark.to})`,
				}}
			/>

			<NoiseOverlay />

			{/* Content wrapper with placement-based padding */}
			<div className={cn("relative", placementStyles[placement])}>
				{/* Inner content with rounded corners */}
				<div
					className={cn(
						"relative overflow-hidden ring-1 ring-marketing-border",
						innerRoundedStyles[placement],
						"*:size-full *:object-cover",
					)}
				>
					{children}
				</div>
			</div>
		</div>
	);
}
