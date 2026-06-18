import type * as React from "react";
import { cn } from "@/lib/utils";

export type EmptyTextProps = React.HtmlHTMLAttributes<HTMLParagraphElement>;
export function EmptyText({
	className,
	children,
	...other
}: EmptyTextProps): React.JSX.Element {
	return (
		<p className={cn("text-muted-foreground text-sm", className)} {...other}>
			{children}
		</p>
	);
}
