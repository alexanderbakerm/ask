import type * as React from "react";
import { Spinner, type SpinnerProps } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type CenteredSpinnerElement = React.ComponentRef<"div">;
export type CenteredSpinnerProps = React.ComponentPropsWithoutRef<"div"> &
	SpinnerProps & {
		containerClassName?: React.HTMLAttributes<HTMLDivElement>["className"];
	};

function CenteredSpinner({
	containerClassName,
	...props
}: CenteredSpinnerProps): React.JSX.Element {
	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-0 flex select-none items-center justify-center opacity-65",
				containerClassName,
			)}
		>
			<Spinner {...props} />
		</div>
	);
}

export { CenteredSpinner };
