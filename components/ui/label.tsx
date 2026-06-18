"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type LabelElement = React.ComponentRef<typeof LabelPrimitive.Root>;
export type LabelProps = React.ComponentPropsWithoutRef<
	typeof LabelPrimitive.Root
>;

function Label({ className, ...props }: LabelProps): React.JSX.Element {
	return (
		<LabelPrimitive.Root
			data-slot="label"
			className={cn(
				"flex items-center gap-2 font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export { Label };
