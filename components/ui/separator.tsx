"use client";

import * as SeparatorPrimitive from "@radix-ui/react-separator";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type SeparatorElement = React.ComponentRef<
	typeof SeparatorPrimitive.Root
>;
export type SeparatorProps = React.ComponentPropsWithoutRef<
	typeof SeparatorPrimitive.Root
>;

function Separator({
	className,
	orientation = "horizontal",
	decorative = true,
	...props
}: SeparatorProps): React.JSX.Element {
	return (
		<SeparatorPrimitive.Root
			data-slot="separator"
			decorative={decorative}
			orientation={orientation}
			className={cn(
				"shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
