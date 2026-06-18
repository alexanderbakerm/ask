"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type InputGroupElement = HTMLDivElement;
export type InputGroupProps = React.ComponentPropsWithoutRef<"div">;

function InputGroup({
	className,
	...props
}: InputGroupProps): React.JSX.Element {
	return (
		<div
			data-slot="input-group"
			role="group"
			className={cn(
				"group/input-group border-input dark:bg-input/30 relative flex w-full items-center rounded-md border shadow-xs transition-[color,box-shadow] outline-none",
				"h-9 min-w-0 has-[>textarea]:h-auto",

				// Variants based on alignment.
				"has-[>[data-align=inline-start]]:[&>input]:pl-2",
				"has-[>[data-align=inline-end]]:[&>input]:pr-2",
				"has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
				"has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",

				// Focus state.
				"has-focus-visible:border-ring has-focus-visible:ring-ring/50 has-focus-visible:ring-[3px]",

				// Error state.
				"has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",

				className,
			)}
			{...props}
		/>
	);
}

const inputGroupAddonVariants = cva(
	"text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50",
	{
		variants: {
			align: {
				"inline-start":
					"order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
				"inline-end":
					"order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
				"block-start":
					"order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 group-has-[>input]/input-group:pt-2.5",
				"block-end":
					"order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 group-has-[>input]/input-group:pb-2.5",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	},
);

export type InputGroupAddonElement = HTMLDivElement;
export type InputGroupAddonProps = React.ComponentPropsWithoutRef<"div"> &
	VariantProps<typeof inputGroupAddonVariants>;

function InputGroupAddon({
	className,
	align = "inline-start",
	...props
}: InputGroupAddonProps): React.JSX.Element {
	return (
		<div
			role="group"
			data-slot="input-group-addon"
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onClick={(e) => {
				if ((e.target as HTMLElement).closest("button")) {
					return;
				}
				e.currentTarget.parentElement?.querySelector("input")?.focus();
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.currentTarget.click();
				}
			}}
			{...props}
		/>
	);
}

const inputGroupButtonVariants = cva(
	"text-sm shadow-none flex gap-2 items-center",
	{
		variants: {
			size: {
				xs: "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
				sm: "h-8 px-2.5 gap-1.5 rounded-md has-[>svg]:px-2.5",
				"icon-xs":
					"size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
				"icon-sm": "size-8 p-0 has-[>svg]:p-0",
			},
		},
		defaultVariants: {
			size: "xs",
		},
	},
);

export type InputGroupButtonElement = React.ComponentRef<typeof Button>;
export type InputGroupButtonProps = Omit<
	React.ComponentPropsWithoutRef<typeof Button>,
	"size"
> &
	VariantProps<typeof inputGroupButtonVariants>;

function InputGroupButton({
	className,
	type = "button",
	variant = "ghost",
	size = "xs",
	...props
}: InputGroupButtonProps): React.JSX.Element {
	return (
		<Button
			type={type}
			data-size={size}
			variant={variant}
			className={cn(inputGroupButtonVariants({ size }), className)}
			{...props}
		/>
	);
}

export type InputGroupTextElement = HTMLSpanElement;
export type InputGroupTextProps = React.ComponentPropsWithoutRef<"span">;

function InputGroupText({
	className,
	...props
}: InputGroupTextProps): React.JSX.Element {
	return (
		<span
			className={cn(
				"text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

export type InputGroupInputElement = React.ComponentRef<typeof Input>;
export type InputGroupInputProps = React.ComponentPropsWithRef<typeof Input>;

const InputGroupInput = React.forwardRef<
	HTMLInputElement,
	InputGroupInputProps
>(({ className, ...props }, ref) => {
	return (
		<Input
			data-slot="input-group-control"
			className={cn(
				"flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
				className,
			)}
			ref={ref}
			{...props}
		/>
	);
});
InputGroupInput.displayName = "InputGroupInput";

export type InputGroupTextareaElement = React.ComponentRef<typeof Textarea>;
export type InputGroupTextareaProps = React.ComponentPropsWithoutRef<
	typeof Textarea
>;

function InputGroupTextarea({
	className,
	...props
}: InputGroupTextareaProps): React.JSX.Element {
	return (
		<Textarea
			data-slot="input-group-control"
			className={cn(
				"flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
				className,
			)}
			{...props}
		/>
	);
}

export {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupText,
	InputGroupInput,
	InputGroupTextarea,
};
