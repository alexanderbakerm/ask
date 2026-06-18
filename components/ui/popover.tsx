"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { cn } from "@/lib/utils";

export type PopoverElement = React.ComponentRef<typeof PopoverPrimitive.Root>;
export type PopoverProps = React.ComponentPropsWithoutRef<
	typeof PopoverPrimitive.Root
>;

const Popover = PopoverPrimitive.Root;

export type PopoverTriggerElement = React.ComponentRef<
	typeof PopoverPrimitive.Trigger
>;
export type PopoverTriggerProps = React.ComponentPropsWithoutRef<
	typeof PopoverPrimitive.Trigger
>;

const PopoverTrigger = PopoverPrimitive.Trigger;

export type PopoverContentElement = React.ComponentRef<
	typeof PopoverPrimitive.Content
>;
export type PopoverContentProps = React.ComponentPropsWithoutRef<
	typeof PopoverPrimitive.Content
>;

const PopoverContent = React.forwardRef<
	PopoverContentElement,
	PopoverContentProps
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
	<PopoverPrimitive.Portal>
		<PopoverPrimitive.Content
			ref={ref}
			data-slot="popover-content"
			align={align}
			sideOffset={sideOffset}
			className={cn(
				"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			{...props}
		/>
	</PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";

export type PopoverAnchorElement = React.ComponentRef<
	typeof PopoverPrimitive.Anchor
>;
export type PopoverAnchorProps = React.ComponentPropsWithoutRef<
	typeof PopoverPrimitive.Anchor
>;

function PopoverAnchor(props: PopoverAnchorProps): React.JSX.Element {
	return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

const PopoverClose = PopoverPrimitive.Close;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose };
