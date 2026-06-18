"use client";

import type { UIMessage } from "@ai-sdk/react";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo, useCallback, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
	from: UIMessage["role"];
	isError?: boolean;
};

export const Message = ({
	className,
	from,
	isError,
	...props
}: MessageProps) => (
	<div
		className={cn(
			"group flex w-full max-w-[80%] flex-col gap-2",
			from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
			isError && "is-error",
			className,
		)}
		{...props}
	/>
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> & {
	isError?: boolean;
};

export const MessageContent = ({
	children,
	className,
	isError,
	...props
}: MessageContentProps) => (
	<div
		className={cn(
			"flex w-fit flex-col gap-2 overflow-hidden text-sm",
			"group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
			"group-[.is-assistant]:text-foreground",
			isError &&
				"rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-destructive",
			className,
		)}
		{...props}
	>
		{children}
	</div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
	className,
	children,
	...props
}: MessageActionsProps) => (
	<div className={cn("flex items-center gap-1", className)} {...props}>
		{children}
	</div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
	tooltip?: string;
	label?: string;
};

export const MessageAction = ({
	tooltip,
	children,
	label,
	variant = "ghost",
	size = "sm",
	...props
}: MessageActionProps) => {
	const button = (
		<Button size={size} type="button" variant={variant} {...props}>
			{children}
			<span className="sr-only">{label || tooltip}</span>
		</Button>
	);

	if (tooltip) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>{button}</TooltipTrigger>
					<TooltipContent>
						<p>{tooltip}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return button;
};

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
	({ className, ...props }: MessageResponseProps) => (
		<Streamdown
			className={cn(
				"size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className,
			)}
			{...props}
		/>
	),
	(prevProps, nextProps) => prevProps.children === nextProps.children,
);

MessageResponse.displayName = "MessageResponse";

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
	className,
	children,
	...props
}: MessageToolbarProps) => (
	<div
		className={cn(
			"mt-4 flex w-full items-center justify-between gap-4",
			className,
		)}
		{...props}
	>
		{children}
	</div>
);

export type MessageCopyButtonProps = Omit<
	ComponentProps<typeof Button>,
	"onClick"
> & {
	content: string;
};

export function MessageCopyButton({
	content,
	className,
	variant = "ghost",
	size = "icon",
	...props
}: MessageCopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Fallback for older browsers
			const textArea = document.createElement("textarea");
			textArea.value = content;
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand("copy");
			document.body.removeChild(textArea);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [content]);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						className={cn("size-7", className)}
						onClick={handleCopy}
						size={size}
						type="button"
						variant={variant}
						{...props}
					>
						{copied ? (
							<CheckIcon className="size-3.5" />
						) : (
							<CopyIcon className="size-3.5" />
						)}
						<span className="sr-only">
							{copied ? "Copied" : "Copy message"}
						</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>{copied ? "Copied!" : "Copy message"}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
