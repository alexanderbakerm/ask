"use client";

import * as MenubarPrimitive from "@radix-ui/react-menubar";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type MenubarElement = React.ComponentRef<typeof MenubarPrimitive.Root>;
export type MenubarProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.Root
>;

function Menubar({ className, ...props }: MenubarProps): React.JSX.Element {
	return (
		<MenubarPrimitive.Root
			data-slot="menubar"
			className={cn(
				"flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
				className,
			)}
			{...props}
		/>
	);
}

export type MenubarMenuElement = React.ComponentRef<
	typeof MenubarPrimitive.Menu
>;
export type MenubarMenuProps = React.ComponentProps<
	typeof MenubarPrimitive.Menu
>;

function MenubarMenu(props: MenubarMenuProps): React.JSX.Element {
	return <MenubarPrimitive.Menu data-slot="menubar-menu" {...props} />;
}

export type MenubarGroupElement = React.ComponentRef<
	typeof MenubarPrimitive.Group
>;
export type MenubarGroupProps = React.ComponentProps<
	typeof MenubarPrimitive.Group
>;

function MenubarGroup(props: MenubarGroupProps): React.JSX.Element {
	return <MenubarPrimitive.Group data-slot="menubar-group" {...props} />;
}

export type MenubarPortalElement = React.ComponentRef<
	typeof MenubarPrimitive.Portal
>;
export type MenubarPortalProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.Portal
>;

function MenubarPortal(props: MenubarPortalProps): React.JSX.Element {
	return <MenubarPrimitive.Portal data-slot="menubar-portal" {...props} />;
}

export type MenubarRadioGroupElement = React.ComponentRef<
	typeof MenubarPrimitive.RadioGroup
>;
export type MenubarRadioGroupProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.RadioGroup
>;

function MenubarRadioGroup(props: MenubarRadioGroupProps): React.JSX.Element {
	return (
		<MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...props} />
	);
}

export type MenubarTriggerElement = React.ComponentRef<
	typeof MenubarPrimitive.Trigger
>;
export type MenubarTriggerProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.Trigger
>;

function MenubarTrigger({
	className,
	...props
}: MenubarTriggerProps): React.JSX.Element {
	return (
		<MenubarPrimitive.Trigger
			data-slot="menubar-trigger"
			className={cn(
				"flex cursor-pointer select-none items-center rounded-sm px-2 py-1 font-medium text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export type MenubarContentElement = React.ComponentRef<
	typeof MenubarPrimitive.Content
>;
export type MenubarContentProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.Content
>;

function MenubarContent({
	className,
	align = "start",
	alignOffset = -4,
	sideOffset = 8,
	...props
}: MenubarContentProps): React.JSX.Element {
	return (
		<MenubarPortal>
			<MenubarPrimitive.Content
				data-slot="menubar-content"
				align={align}
				alignOffset={alignOffset}
				sideOffset={sideOffset}
				className={cn(
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-48 origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in",
					className,
				)}
				{...props}
			/>
		</MenubarPortal>
	);
}

export type MenubarItemElement = React.ComponentRef<
	typeof MenubarPrimitive.Item
>;
export type MenubarItemProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.Item
> & {
	inset?: boolean;
	variant?: "default" | "destructive";
};

function MenubarItem({
	className,
	inset,
	variant = "default",
	...props
}: MenubarItemProps): React.JSX.Element {
	return (
		<MenubarPrimitive.Item
			data-slot="menubar-item"
			data-inset={inset}
			data-variant={variant}
			className={cn(
				"relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-inset:pl-8 data-[variant=destructive]:text-destructive data-disabled:opacity-50 data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 data-[variant=destructive]:*:[svg]:text-destructive!",
				className,
			)}
			{...props}
		/>
	);
}

export type MenubarCheckboxItemElement = React.ComponentRef<
	typeof MenubarPrimitive.CheckboxItem
>;
export type MenubarCheckboxItemProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.CheckboxItem
>;

function MenubarCheckboxItem({
	className,
	children,
	checked,
	...props
}: MenubarCheckboxItemProps): React.JSX.Element {
	return (
		<MenubarPrimitive.CheckboxItem
			data-slot="menubar-checkbox-item"
			className={cn(
				"relative flex cursor-pointer select-none items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			checked={checked}
			{...props}
		>
			<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
				<MenubarPrimitive.ItemIndicator>
					<CheckIcon className="size-4" />
				</MenubarPrimitive.ItemIndicator>
			</span>
			{children}
		</MenubarPrimitive.CheckboxItem>
	);
}

export type MenubarRadioItemElement = React.ComponentRef<
	typeof MenubarPrimitive.RadioItem
>;
export type MenubarRadioItemProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.RadioItem
>;

function MenubarRadioItem({
	className,
	children,
	...props
}: MenubarRadioItemProps): React.JSX.Element {
	return (
		<MenubarPrimitive.RadioItem
			data-slot="menubar-radio-item"
			className={cn(
				"relative flex cursor-pointer select-none items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
				<MenubarPrimitive.ItemIndicator>
					<CircleIcon className="size-2 fill-current" />
				</MenubarPrimitive.ItemIndicator>
			</span>
			{children}
		</MenubarPrimitive.RadioItem>
	);
}

export type MenubarLabelElement = React.ComponentRef<
	typeof MenubarPrimitive.Label
>;
export type MenubarLabelProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.Label
> & {
	inset?: boolean;
};

function MenubarLabel({
	className,
	inset,
	...props
}: MenubarLabelProps): React.JSX.Element {
	return (
		<MenubarPrimitive.Label
			data-slot="menubar-label"
			data-inset={inset}
			className={cn(
				"px-2 py-1.5 font-medium text-sm data-inset:pl-8",
				className,
			)}
			{...props}
		/>
	);
}

export type MenubarSeparatorElement = React.ComponentRef<
	typeof MenubarPrimitive.Separator
>;
export type MenubarSeparatorProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.Separator
>;

function MenubarSeparator({
	className,
	...props
}: MenubarSeparatorProps): React.JSX.Element {
	return (
		<MenubarPrimitive.Separator
			data-slot="menubar-separator"
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

export type MenubarShortcutElement = React.ComponentRef<"span">;
export type MenubarShortcutProps = React.ComponentPropsWithoutRef<"span">;

function MenubarShortcut({
	className,
	...props
}: MenubarShortcutProps): React.JSX.Element {
	return (
		<span
			data-slot="menubar-shortcut"
			className={cn(
				"ml-auto text-muted-foreground text-xs tracking-widest",
				className,
			)}
			{...props}
		/>
	);
}

export type MenubarSubElement = React.ComponentRef<typeof MenubarPrimitive.Sub>;
export type MenubarSubProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.Sub
>;

function MenubarSub(props: MenubarSubProps): React.JSX.Element {
	return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

export type MenubarSubTriggerElement = React.ComponentRef<
	typeof MenubarPrimitive.SubTrigger
>;
export type MenubarSubTriggerProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.SubTrigger
> & {
	inset?: boolean;
};

function MenubarSubTrigger({
	className,
	inset,
	children,
	...props
}: MenubarSubTriggerProps): React.JSX.Element {
	return (
		<MenubarPrimitive.SubTrigger
			data-slot="menubar-sub-trigger"
			data-inset={inset}
			className={cn(
				"flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-inset:pl-8 data-[state=open]:text-accent-foreground",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className="ml-auto h-4 w-4" />
		</MenubarPrimitive.SubTrigger>
	);
}

export type MenubarSubContentElement = React.ComponentRef<
	typeof MenubarPrimitive.SubContent
>;
export type MenubarSubContentProps = React.ComponentPropsWithoutRef<
	typeof MenubarPrimitive.SubContent
>;

function MenubarSubContent({
	className,
	...props
}: MenubarSubContentProps): React.JSX.Element {
	return (
		<MenubarPrimitive.SubContent
			data-slot="menubar-sub-content"
			className={cn(
				"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Menubar,
	MenubarPortal,
	MenubarMenu,
	MenubarTrigger,
	MenubarContent,
	MenubarGroup,
	MenubarSeparator,
	MenubarLabel,
	MenubarItem,
	MenubarShortcut,
	MenubarCheckboxItem,
	MenubarRadioGroup,
	MenubarRadioItem,
	MenubarSub,
	MenubarSubTrigger,
	MenubarSubContent,
};
