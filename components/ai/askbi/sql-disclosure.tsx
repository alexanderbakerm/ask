"use client";

import { ChevronRightIcon, Code2Icon } from "lucide-react";
import { useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * The executed SQL — always present, one click away. Collapsed by default so it
 * doesn't dominate, but never hidden: trust depends on the user being able to
 * see exactly what ran.
 */
export function SqlDisclosure({ sql }: { sql: string }): React.JSX.Element {
	const [open, setOpen] = useState(false);
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			className="rounded-md border bg-muted/30"
		>
			<CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground text-xs transition-colors hover:text-foreground">
				<ChevronRightIcon
					className={cn("size-3.5 transition-transform", open && "rotate-90")}
				/>
				<Code2Icon className="size-3.5" />
				<span>View SQL</span>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<pre className="overflow-auto px-3 pb-3 text-xs leading-relaxed">
					<code>{sql}</code>
				</pre>
			</CollapsibleContent>
		</Collapsible>
	);
}
