"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type ItemGroupElement = HTMLDivElement;
export type ItemGroupProps = React.ComponentPropsWithoutRef<"div">;

function ItemGroup({ className, ...props }: ItemGroupProps): React.JSX.Element {
	return (
		<div
			role="list"
			data-slot="item-group"
			className={cn("group/item-group flex flex-col", className)}
			{...props}
		/>
	);
}

export type ItemSeparatorElement = React.ComponentRef<typeof Separator>;
export type ItemSeparatorProps = React.ComponentPropsWithoutRef<
	typeof Separator
>;

function ItemSeparator({
	className,
	...props
}: ItemSeparatorProps): React.JSX.Element {
	return (
		<Separator
			data-slot="item-separator"
			orientation="horizontal"
			className={cn("my-0", className)}
			{...props}
		/>
	);
}

const itemVariants = cva(
	"group/item flex items-center border border-transparent text-sm rounded-md transition-colors [a]:hover:bg-accent/50 [a]:transition-colors duration-100 flex-wrap outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline: "border-border",
				muted: "bg-muted/50",
			},
			size: {
				default: "p-4 gap-4 ",
				sm: "py-3 px-4 gap-2.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export type ItemElement = HTMLDivElement;
export type ItemProps = React.ComponentPropsWithoutRef<"div"> &
	VariantProps<typeof itemVariants> & { asChild?: boolean };

function Item({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: ItemProps): React.JSX.Element {
	const Comp = asChild ? Slot : "div";
	return (
		<Comp
			data-slot="item"
			data-variant={variant}
			data-size={size}
			className={cn(itemVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

const itemMediaVariants = cva(
	"flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none group-has-[[data-slot=item-description]]/item:translate-y-0.5",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "size-8 border rounded-sm bg-muted [&_svg:not([class*='size-'])]:size-4",
				image:
					"size-10 rounded-sm overflow-hidden [&_img]:size-full [&_img]:object-cover",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export type ItemMediaElement = HTMLDivElement;
export type ItemMediaProps = React.ComponentPropsWithoutRef<"div"> &
	VariantProps<typeof itemMediaVariants>;

function ItemMedia({
	className,
	variant = "default",
	...props
}: ItemMediaProps): React.JSX.Element {
	return (
		<div
			data-slot="item-media"
			data-variant={variant}
			className={cn(itemMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

export type ItemContentElement = HTMLDivElement;
export type ItemContentProps = React.ComponentPropsWithoutRef<"div">;

function ItemContent({
	className,
	...props
}: ItemContentProps): React.JSX.Element {
	return (
		<div
			data-slot="item-content"
			className={cn(
				"flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
				className,
			)}
			{...props}
		/>
	);
}

export type ItemTitleElement = HTMLDivElement;
export type ItemTitleProps = React.ComponentPropsWithoutRef<"div">;

function ItemTitle({ className, ...props }: ItemTitleProps): React.JSX.Element {
	return (
		<div
			data-slot="item-title"
			className={cn(
				"flex w-fit items-center gap-2 text-sm leading-snug font-medium",
				className,
			)}
			{...props}
		/>
	);
}

export type ItemDescriptionElement = HTMLParagraphElement;
export type ItemDescriptionProps = React.ComponentPropsWithoutRef<"p">;

function ItemDescription({
	className,
	...props
}: ItemDescriptionProps): React.JSX.Element {
	return (
		<p
			data-slot="item-description"
			className={cn(
				"text-muted-foreground line-clamp-2 text-sm leading-normal font-normal text-balance",
				"[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
}

export type ItemActionsElement = HTMLDivElement;
export type ItemActionsProps = React.ComponentPropsWithoutRef<"div">;

function ItemActions({
	className,
	...props
}: ItemActionsProps): React.JSX.Element {
	return (
		<div
			data-slot="item-actions"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	);
}

export type ItemHeaderElement = HTMLDivElement;
export type ItemHeaderProps = React.ComponentPropsWithoutRef<"div">;

function ItemHeader({
	className,
	...props
}: ItemHeaderProps): React.JSX.Element {
	return (
		<div
			data-slot="item-header"
			className={cn(
				"flex basis-full items-center justify-between gap-2",
				className,
			)}
			{...props}
		/>
	);
}

export type ItemFooterElement = HTMLDivElement;
export type ItemFooterProps = React.ComponentPropsWithoutRef<"div">;

function ItemFooter({
	className,
	...props
}: ItemFooterProps): React.JSX.Element {
	return (
		<div
			data-slot="item-footer"
			className={cn(
				"flex basis-full items-center justify-between gap-2",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Item,
	ItemMedia,
	ItemContent,
	ItemActions,
	ItemGroup,
	ItemSeparator,
	ItemTitle,
	ItemDescription,
	ItemHeader,
	ItemFooter,
};
