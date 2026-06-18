"use client";

import type * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useStorage } from "@/hooks/use-storage";
import { cn } from "@/lib/utils";

export type UserAvatarProps = {
	name: string;
	src?: string | null;
	className?: string;
	fallbackClassName?: string;
};

export function UserAvatar({
	name,
	src,
	className,
	fallbackClassName,
}: UserAvatarProps): React.JSX.Element {
	const signedUrl = useStorage(src);
	return (
		<Avatar className={cn("size-8 group-focus:ring-2", className)}>
			<AvatarImage src={signedUrl ?? undefined} />
			<AvatarFallback
				className={cn("bg-neutral-200 dark:bg-neutral-700", fallbackClassName)}
			>
				<span className="uppercase" suppressHydrationWarning>
					{name?.slice(0, 1)}
				</span>
			</AvatarFallback>
		</Avatar>
	);
}
