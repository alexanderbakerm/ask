import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type EmptyElement = HTMLDivElement;
export type EmptyProps = React.ComponentPropsWithoutRef<"div">;

function Empty({ className, ...props }: EmptyProps): React.JSX.Element {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
				className,
			)}
			{...props}
		/>
	);
}

export type EmptyHeaderElement = HTMLDivElement;
export type EmptyHeaderProps = React.ComponentPropsWithoutRef<"div">;

function EmptyHeader({
	className,
	...props
}: EmptyHeaderProps): React.JSX.Element {
	return (
		<div
			data-slot="empty-header"
			className={cn(
				"flex max-w-sm flex-col items-center gap-2 text-center",
				className,
			)}
			{...props}
		/>
	);
}

export const emptyMediaVariants = cva(
	"flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export type EmptyMediaElement = HTMLDivElement;
export type EmptyMediaProps = React.ComponentPropsWithoutRef<"div"> &
	VariantProps<typeof emptyMediaVariants>;

function EmptyMedia({
	className,
	variant = "default",
	...props
}: EmptyMediaProps): React.JSX.Element {
	return (
		<div
			data-slot="empty-icon"
			data-variant={variant}
			className={cn(emptyMediaVariants({ variant, className }))}
			{...props}
		/>
	);
}

export type EmptyTitleElement = HTMLDivElement;
export type EmptyTitleProps = React.ComponentPropsWithoutRef<"div">;

function EmptyTitle({
	className,
	...props
}: EmptyTitleProps): React.JSX.Element {
	return (
		<div
			data-slot="empty-title"
			className={cn("text-lg font-medium tracking-tight", className)}
			{...props}
		/>
	);
}

export type EmptyDescriptionElement = HTMLParagraphElement;
export type EmptyDescriptionProps = React.ComponentPropsWithoutRef<"div">;

function EmptyDescription({
	className,
	...props
}: EmptyDescriptionProps): React.JSX.Element {
	return (
		<div
			data-slot="empty-description"
			className={cn(
				"text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
}

export type EmptyContentElement = HTMLDivElement;
export type EmptyContentProps = React.ComponentPropsWithoutRef<"div">;

function EmptyContent({
	className,
	...props
}: EmptyContentProps): React.JSX.Element {
	return (
		<div
			data-slot="empty-content"
			className={cn(
				"flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Empty,
	EmptyHeader,
	EmptyTitle,
	EmptyDescription,
	EmptyContent,
	EmptyMedia,
};
