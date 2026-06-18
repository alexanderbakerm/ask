"use client";

import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type ContextMenuElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Root
>;
export type ContextMenuProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Root
>;

function ContextMenu(props: ContextMenuProps): React.JSX.Element {
	return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

export type ContextMenuTriggerElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Trigger
>;
export type ContextMenuTriggerProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Trigger
>;

function ContextMenuTrigger(props: ContextMenuTriggerProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
	);
}

export type ContextMenuGroupElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Group
>;
export type ContextMenuGroupProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Group
>;

function ContextMenuGroup(props: ContextMenuGroupProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
	);
}

export type ContextMenuPortalElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Portal
>;
export type ContextMenuPortalProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Portal
>;

function ContextMenuPortal(props: ContextMenuPortalProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
	);
}

export type ContextMenuSubElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Sub
>;
export type ContextMenuSubProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Sub
>;

function ContextMenuSub(props: ContextMenuSubProps): React.JSX.Element {
	return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

export type ContextMenuRadioGroupElement = React.ComponentRef<
	typeof ContextMenuPrimitive.RadioGroup
>;
export type ContextMenuRadioGroupProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.RadioGroup
>;

function ContextMenuRadioGroup(
	props: ContextMenuRadioGroupProps,
): React.JSX.Element {
	return (
		<ContextMenuPrimitive.RadioGroup
			data-slot="context-menu-radio-group"
			{...props}
		/>
	);
}

export type ContextMenuSubTriggerElement = React.ComponentRef<
	typeof ContextMenuPrimitive.SubTrigger
>;
export type ContextMenuSubTriggerProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.SubTrigger
> & {
	inset?: boolean;
};

function ContextMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: ContextMenuSubTriggerProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.SubTrigger
			data-slot="context-menu-sub-trigger"
			data-inset={inset}
			className={cn(
				"flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-inset:pl-8 data-[state=open]:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className="ml-auto" />
		</ContextMenuPrimitive.SubTrigger>
	);
}

export type ContextMenuSubContentElement = React.ComponentRef<
	typeof ContextMenuPrimitive.SubContent
>;
export type ContextMenuSubContentProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.SubContent
>;

function ContextMenuSubContent({
	className,
	...props
}: ContextMenuSubContentProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.SubContent
			data-slot="context-menu-sub-content"
			className={cn(
				"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border bg-popover fill-mode-forwards! p-1 text-popover-foreground shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in",
				className,
			)}
			{...props}
		/>
	);
}

export type ContextMenuContentElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Content
>;
export type ContextMenuContentProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Content
>;

function ContextMenuContent({
	className,
	...props
}: ContextMenuContentProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Content
				data-slot="context-menu-content"
				className={cn(
					"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-context-menu-content-available-height) min-w-32 origin-(--radix-context-menu-content-transform-origin) overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in",
					className,
				)}
				{...props}
			/>
		</ContextMenuPrimitive.Portal>
	);
}

export type ContextMenuItemElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Item
>;
export type ContextMenuItemProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Item
> & {
	inset?: boolean;
	variant?: "default" | "destructive";
};

function ContextMenuItem({
	className,
	inset,
	variant = "default",
	...props
}: ContextMenuItemProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Item
			data-slot="context-menu-item"
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

export type ContextMenuCheckboxItemElement = React.ComponentRef<
	typeof ContextMenuPrimitive.CheckboxItem
>;
export type ContextMenuCheckboxItemProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.CheckboxItem
>;

function ContextMenuCheckboxItem({
	className,
	children,
	checked,
	...props
}: ContextMenuCheckboxItemProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.CheckboxItem
			data-slot="context-menu-checkbox-item"
			className={cn(
				"relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			checked={checked}
			{...props}
		>
			<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
				<ContextMenuPrimitive.ItemIndicator>
					<CheckIcon className="size-4" />
				</ContextMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.CheckboxItem>
	);
}

export type ContextMenuRadioItemElement = React.ComponentRef<
	typeof ContextMenuPrimitive.RadioItem
>;
export type ContextMenuRadioItemProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.RadioItem
>;

function ContextMenuRadioItem({
	className,
	children,
	...props
}: ContextMenuRadioItemProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.RadioItem
			data-slot="context-menu-radio-item"
			className={cn(
				"relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
				<ContextMenuPrimitive.ItemIndicator>
					<CircleIcon className="size-2 fill-current" />
				</ContextMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</ContextMenuPrimitive.RadioItem>
	);
}

export type ContextMenuLabelElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Label
>;
export type ContextMenuLabelProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Label
> & {
	inset?: boolean;
};

function ContextMenuLabel({
	className,
	inset,
	...props
}: ContextMenuLabelProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Label
			data-slot="context-menu-label"
			data-inset={inset}
			className={cn(
				"px-2 py-1.5 font-medium text-foreground text-sm data-inset:pl-8",
				className,
			)}
			{...props}
		/>
	);
}

export type ContextMenuSeparatorElement = React.ComponentRef<
	typeof ContextMenuPrimitive.Separator
>;
export type ContextMenuSeparatorProps = React.ComponentPropsWithoutRef<
	typeof ContextMenuPrimitive.Separator
>;

function ContextMenuSeparator({
	className,
	...props
}: ContextMenuSeparatorProps): React.JSX.Element {
	return (
		<ContextMenuPrimitive.Separator
			data-slot="context-menu-separator"
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

export type ContextMenuShortcutElement = React.ComponentRef<"span">;
export type ContextMenuShortcutProps = React.ComponentPropsWithoutRef<"span">;

function ContextMenuShortcut({
	className,
	...props
}: ContextMenuShortcutProps): React.JSX.Element {
	return (
		<span
			data-slot="context-menu-shortcut"
			className={cn(
				"ml-auto text-muted-foreground text-xs tracking-widest",
				className,
			)}
			{...props}
		/>
	);
}

export {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuCheckboxItem,
	ContextMenuRadioItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuGroup,
	ContextMenuPortal,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuRadioGroup,
};
