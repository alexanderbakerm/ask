import type React from "react";
import { cn } from "@/lib/utils";

export type SkeletonElement = HTMLDivElement;
export type SkeletonProps = React.ComponentPropsWithoutRef<"div">;

function Skeleton({ className, ...props }: SkeletonProps): React.JSX.Element {
	return (
		<div
			data-slot="skeleton"
			className={cn("animate-pulse rounded-md bg-accent", className)}
			{...props}
		/>
	);
}

export { Skeleton };
