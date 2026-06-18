"use client";

import type * as React from "react";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	type AvatarProps,
} from "@/components/ui/avatar";
import { useStorage } from "@/hooks/use-storage";
import { cn } from "@/lib/utils";

export type OrganizationLogoProps = AvatarProps & {
	name: string;
	src?: string | null;
	fallbackClassName?: string;
};

export function OrganizationLogo({
	name,
	src,
	className,
	fallbackClassName,
}: OrganizationLogoProps): React.JSX.Element {
	const signedUrl = useStorage(src);
	return (
		<Avatar className={cn("size-8 rounded-md group-focus:ring-2", className)}>
			<AvatarImage className="rounded-md" src={signedUrl ?? undefined} />
			<AvatarFallback
				className={cn(
					"rounded-md bg-neutral-200 dark:bg-neutral-700",
					fallbackClassName,
				)}
			>
				<span className="uppercase" suppressHydrationWarning>
					{name?.slice(0, 1)}
				</span>
			</AvatarFallback>
		</Avatar>
	);
}
