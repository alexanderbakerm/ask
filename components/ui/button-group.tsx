import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const buttonGroupVariants = cva(
	"flex w-fit items-stretch [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md has-[>[data-slot=button-group]]:gap-2",
	{
		variants: {
			orientation: {
				horizontal:
					"[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
				vertical:
					"flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
			},
		},
		defaultVariants: {
			orientation: "horizontal",
		},
	},
);

export type ButtonGroupElement = HTMLDivElement;
export type ButtonGroupProps = React.ComponentPropsWithoutRef<"div"> &
	VariantProps<typeof buttonGroupVariants>;

function ButtonGroup({
	className,
	orientation,
	...props
}: ButtonGroupProps): React.JSX.Element {
	return (
		<div
			role="group"
			data-slot="button-group"
			data-orientation={orientation}
			className={cn(buttonGroupVariants({ orientation }), className)}
			{...props}
		/>
	);
}

export type ButtonGroupTextElement = HTMLDivElement;
export type ButtonGroupTextProps = React.ComponentPropsWithoutRef<"div"> & {
	asChild?: boolean;
};

function ButtonGroupText({
	className,
	asChild = false,
	...props
}: ButtonGroupTextProps): React.JSX.Element {
	const Comp = asChild ? Slot : "div";

	return (
		<Comp
			className={cn(
				"bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

export type ButtonGroupSeparatorElement = React.ComponentRef<typeof Separator>;
export type ButtonGroupSeparatorProps = React.ComponentPropsWithoutRef<
	typeof Separator
>;

function ButtonGroupSeparator({
	className,
	orientation = "vertical",
	...props
}: ButtonGroupSeparatorProps): React.JSX.Element {
	return (
		<Separator
			data-slot="button-group-separator"
			orientation={orientation}
			className={cn(
				"bg-input relative !m-0 self-stretch data-[orientation=vertical]:h-auto",
				className,
			)}
			{...props}
		/>
	);
}

export {
	ButtonGroup,
	ButtonGroupSeparator,
	ButtonGroupText,
	buttonGroupVariants,
};
