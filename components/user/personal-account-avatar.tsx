import { User2Icon } from "lucide-react";
import type * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type PersonalAccountAvatarProps = {
	className?: string;
	fallbackClassName?: string;
};

export function PersonalAccountAvatar({
	className,
	fallbackClassName,
}: PersonalAccountAvatarProps): React.JSX.Element {
	return (
		<Avatar className={cn("size-8 group-focus:ring-2", className)}>
			<AvatarFallback className={cn("bg-transparent", fallbackClassName)}>
				<User2Icon className="size-5 shrink-0" />
			</AvatarFallback>
		</Avatar>
	);
}
