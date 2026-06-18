"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type ScrollAreaElement = React.ComponentRef<
	typeof ScrollAreaPrimitive.Root
>;
export type ScrollAreaProps = React.ComponentPropsWithoutRef<
	typeof ScrollAreaPrimitive.Root
> & {
	verticalScrollBar?: boolean;
	horizontalScrollBar?: boolean;
};

function ScrollArea({
	verticalScrollBar = true,
	horizontalScrollBar = false,
	className,
	children,
	...props
}: ScrollAreaProps): React.JSX.Element {
	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area"
			className={cn("relative", className)}
			{...props}
		>
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className="size-full rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			{verticalScrollBar && <ScrollBar orientation="vertical" />}
			{horizontalScrollBar && <ScrollBar orientation="horizontal" />}
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

export type ScrollBarElement = React.ComponentRef<
	typeof ScrollAreaPrimitive.ScrollAreaScrollbar
>;
export type ScrollBarProps = React.ComponentPropsWithoutRef<
	typeof ScrollAreaPrimitive.ScrollAreaScrollbar
>;

function ScrollBar({
	className,
	orientation = "vertical",
	...props
}: ScrollBarProps): React.JSX.Element {
	return (
		<ScrollAreaPrimitive.ScrollAreaScrollbar
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			className={cn(
				"flex touch-none select-none p-px transition-colors",
				orientation === "vertical" &&
					"h-full w-2.5 border-l border-l-transparent",
				orientation === "horizontal" &&
					"h-2.5 flex-col border-t border-t-transparent",
				className,
			)}
			{...props}
		>
			<ScrollAreaPrimitive.ScrollAreaThumb
				data-slot="scroll-area-thumb"
				className="relative flex-1 rounded-full bg-border"
			/>
		</ScrollAreaPrimitive.ScrollAreaScrollbar>
	);
}

export { ScrollArea, ScrollBar };
