import type * as React from "react";
import { cn } from "@/lib/utils";

export type KbdElement = HTMLElement;
export type KbdProps = React.ComponentPropsWithoutRef<"kbd">;

function Kbd({ className, ...props }: KbdProps): React.JSX.Element {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none",
				"[&_svg:not([class*='size-'])]:size-3",
				"[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
				className,
			)}
			{...props}
		/>
	);
}

export type KbdGroupElement = HTMLElement;
export type KbdGroupProps = React.ComponentPropsWithoutRef<"div">;

function KbdGroup({ className, ...props }: KbdGroupProps): React.JSX.Element {
	return (
		<kbd
			data-slot="kbd-group"
			className={cn("inline-flex items-center gap-1", className)}
			{...props}
		/>
	);
}

export { Kbd, KbdGroup };
