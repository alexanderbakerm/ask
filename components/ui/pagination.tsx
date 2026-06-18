import {
	ChevronLeftIcon,
	ChevronRightIcon,
	MoreHorizontalIcon,
} from "lucide-react";
import type * as React from "react";
import { type Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaginationElement = HTMLElement;
export type PaginationProps = React.ComponentPropsWithoutRef<"nav">;

function Pagination({
	className,
	...props
}: PaginationProps): React.JSX.Element {
	return (
		<nav
			aria-label="pagination"
			data-slot="pagination"
			className={cn("mx-auto flex w-full justify-center", className)}
			{...props}
		/>
	);
}

export type PaginationContentElement = HTMLUListElement;
export type PaginationContentProps = React.ComponentPropsWithoutRef<"ul">;

function PaginationContent({
	className,
	...props
}: PaginationContentProps): React.JSX.Element {
	return (
		<ul
			data-slot="pagination-content"
			className={cn("flex flex-row items-center gap-1", className)}
			{...props}
		/>
	);
}

export type PaginationItemElement = HTMLLIElement;
export type PaginationItemProps = React.ComponentPropsWithoutRef<"li">;

function PaginationItem({ ...props }: PaginationItemProps): React.JSX.Element {
	return <li data-slot="pagination-item" {...props} />;
}

export type PaginationLinkProps = {
	isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
	React.ComponentPropsWithoutRef<"a">;

function PaginationLink({
	className,
	isActive,
	size = "icon",
	...props
}: PaginationLinkProps): React.JSX.Element {
	return (
		<a
			aria-current={isActive ? "page" : undefined}
			data-slot="pagination-link"
			data-active={isActive}
			className={cn(
				buttonVariants({
					variant: isActive ? "outline" : "ghost",
					size,
				}),
				"cursor-pointer",
				className,
			)}
			{...props}
		/>
	);
}

export type PaginationPreviousProps = React.ComponentPropsWithoutRef<
	typeof PaginationLink
>;

function PaginationPrevious({
	className,
	...props
}: PaginationPreviousProps): React.JSX.Element {
	return (
		<PaginationLink
			aria-label="Go to previous page"
			size="default"
			className={cn("gap-1 px-2.5 sm:pl-2.5", className)}
			{...props}
		>
			<ChevronLeftIcon />
			<span className="hidden sm:block">Previous</span>
		</PaginationLink>
	);
}

export type PaginationNextProps = React.ComponentPropsWithoutRef<
	typeof PaginationLink
>;

function PaginationNext({
	className,
	...props
}: PaginationNextProps): React.JSX.Element {
	return (
		<PaginationLink
			aria-label="Go to next page"
			size="default"
			className={cn("gap-1 px-2.5 sm:pr-2.5", className)}
			{...props}
		>
			<span className="hidden sm:block">Next</span>
			<ChevronRightIcon />
		</PaginationLink>
	);
}

export type PaginationEllipsisElement = HTMLSpanElement;
export type PaginationEllipsisProps = React.ComponentPropsWithoutRef<"span">;

function PaginationEllipsis({
	className,
	...props
}: PaginationEllipsisProps): React.JSX.Element {
	return (
		<span
			aria-hidden
			data-slot="pagination-ellipsis"
			className={cn("flex size-9 items-center justify-center", className)}
			{...props}
		>
			<MoreHorizontalIcon className="size-4" />
			<span className="sr-only">More pages</span>
		</span>
	);
}

export {
	Pagination,
	PaginationContent,
	PaginationLink,
	PaginationItem,
	PaginationPrevious,
	PaginationNext,
	PaginationEllipsis,
};
