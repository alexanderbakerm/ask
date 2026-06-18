"use client";

import {
	CornerDownLeftIcon,
	Loader2Icon,
	SquareIcon,
	XIcon,
} from "lucide-react";
import {
	type ChangeEventHandler,
	Children,
	type ComponentProps,
	type FormEvent,
	type FormEventHandler,
	type HTMLAttributes,
	type KeyboardEventHandler,
	useState,
} from "react";

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type PromptInputMessage = {
	text: string;
};

export type PromptInputProps = Omit<
	HTMLAttributes<HTMLFormElement>,
	"onSubmit"
> & {
	value?: string;
	onChange?: (value: string) => void;
	onSubmit: (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
	) => void | Promise<void>;
};

export const PromptInput = ({
	className,
	value,
	onChange,
	onSubmit,
	children,
	...props
}: PromptInputProps) => {
	const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
		event.preventDefault();

		const form = event.currentTarget;
		const text =
			value ??
			(() => {
				const formData = new FormData(form);
				return (formData.get("message") as string) || "";
			})();

		if (!text.trim()) return;

		const result = onSubmit({ text }, event);

		if (result instanceof Promise) {
			result.then(() => {
				if (!value) {
					form.reset();
				}
			});
		} else if (!value) {
			form.reset();
		}
	};

	return (
		<form className="w-full" onSubmit={handleSubmit} {...props}>
			<InputGroup className={cn("overflow-hidden", className)}>
				{children}
			</InputGroup>
		</form>
	);
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({
	className,
	...props
}: PromptInputBodyProps) => (
	<div className={cn("contents", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<
	typeof InputGroupTextarea
> & {
	value?: string;
	onValueChange?: (value: string) => void;
};

export const PromptInputTextarea = ({
	onChange,
	value,
	onValueChange,
	className,
	placeholder = "What would you like to know?",
	...props
}: PromptInputTextareaProps) => {
	const [isComposing, setIsComposing] = useState(false);

	const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
		if (e.key === "Enter") {
			if (isComposing || e.nativeEvent.isComposing) {
				return;
			}
			if (e.shiftKey) {
				return;
			}
			e.preventDefault();

			const form = e.currentTarget.form;
			const submitButton = form?.querySelector(
				'button[type="submit"]',
			) as HTMLButtonElement | null;
			if (submitButton?.disabled) {
				return;
			}

			form?.requestSubmit();
		}
	};

	const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
		onValueChange?.(e.currentTarget.value);
		onChange?.(e);
	};

	return (
		<InputGroupTextarea
			className={cn("field-sizing-content max-h-48 min-h-16", className)}
			name="message"
			onCompositionEnd={() => setIsComposing(false)}
			onCompositionStart={() => setIsComposing(true)}
			onKeyDown={handleKeyDown}
			onChange={handleChange}
			placeholder={placeholder}
			value={value}
			{...props}
		/>
	);
};

export type PromptInputFooterProps = Omit<
	ComponentProps<typeof InputGroupAddon>,
	"align"
>;

export const PromptInputFooter = ({
	className,
	...props
}: PromptInputFooterProps) => (
	<InputGroupAddon
		align="block-end"
		className={cn("justify-between gap-1", className)}
		{...props}
	/>
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
	className,
	...props
}: PromptInputToolsProps) => (
	<div className={cn("flex items-center gap-1", className)} {...props} />
);

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;

export const PromptInputButton = ({
	variant = "ghost",
	className,
	size,
	...props
}: PromptInputButtonProps) => {
	const newSize =
		size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

	return (
		<InputGroupButton
			className={cn(className)}
			size={newSize}
			type="button"
			variant={variant}
			{...props}
		/>
	);
};

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
	status?: ChatStatus;
};

export const PromptInputSubmit = ({
	className,
	variant = "default",
	size = "icon-sm",
	status,
	children,
	...props
}: PromptInputSubmitProps) => {
	let Icon = <CornerDownLeftIcon className="size-4" />;

	if (status === "submitted") {
		Icon = <Loader2Icon className="size-4 animate-spin" />;
	} else if (status === "streaming") {
		Icon = <SquareIcon className="size-4" />;
	} else if (status === "error") {
		Icon = <XIcon className="size-4" />;
	}

	return (
		<InputGroupButton
			aria-label="Submit"
			className={cn(className)}
			size={size}
			type="submit"
			variant={variant}
			{...props}
		>
			{children ?? Icon}
		</InputGroupButton>
	);
};
