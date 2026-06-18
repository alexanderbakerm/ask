"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type UnderlinedTabsElement = React.ComponentRef<
	typeof TabsPrimitive.Root
>;
export type UnderlinedTabsProps = React.ComponentPropsWithoutRef<
	typeof TabsPrimitive.Root
>;

function UnderlinedTabs({
	className,
	...props
}: UnderlinedTabsProps): React.JSX.Element {
	return (
		<TabsPrimitive.Root
			data-slot="underlined-tabs"
			className={cn("flex flex-col", className)}
			{...props}
		/>
	);
}

export type UnderlinedTabsListElement = React.ComponentRef<
	typeof TabsPrimitive.List
>;
export type UnderlinedTabsListProps = React.ComponentPropsWithoutRef<
	typeof TabsPrimitive.List
>;

function UnderlinedTabsList({
	className,
	...props
}: UnderlinedTabsListProps): React.JSX.Element {
	return (
		<TabsPrimitive.List
			data-slot="underlined-tabs-list"
			className={cn(
				"inline-flex h-12 items-center justify-start text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export type UnderlinedTabsTriggerElement = React.ComponentRef<
	typeof TabsPrimitive.Trigger
>;
export type UnderlinedTabsTriggerProps = React.ComponentPropsWithoutRef<
	typeof TabsPrimitive.Trigger
>;

function UnderlinedTabsTrigger({
	className,
	...props
}: UnderlinedTabsTriggerProps): React.JSX.Element {
	return (
		<TabsPrimitive.Trigger
			data-slot="underlined-tabs-trigger"
			className={cn(
				"group relative mx-4 inline-flex h-12 cursor-pointer items-center justify-center whitespace-nowrap rounded-none border-b border-b-transparent bg-transparent py-1 pt-2 pb-3 text-muted-foreground text-sm shadow-none ring-offset-background transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-b-primary data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none",
				className,
			)}
			{...props}
		/>
	);
}

export type UnderlinedTabsContentElement = React.ComponentRef<
	typeof TabsPrimitive.Content
>;
export type UnderlinedTabsContentProps = React.ComponentPropsWithoutRef<
	typeof TabsPrimitive.Content
>;

function UnderlinedTabsContent({
	className,
	...props
}: UnderlinedTabsContentProps): React.JSX.Element {
	return (
		<TabsPrimitive.Content
			data-slot="underlined-tabs-content"
			className={cn("flex-1 outline-none", className)}
			{...props}
		/>
	);
}

export {
	UnderlinedTabs,
	UnderlinedTabsContent,
	UnderlinedTabsList,
	UnderlinedTabsTrigger,
};
