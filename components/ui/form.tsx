"use client";

import type * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import {
	Controller,
	type ControllerProps,
	type FieldPath,
	type FieldValues,
	FormProvider,
	useFormContext,
	useFormState,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;

type FormFieldContextValue<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
	name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
	{} as FormFieldContextValue,
);

const FormField = <
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
	...props
}: ControllerProps<TFieldValues, TName>) => {
	return (
		<FormFieldContext.Provider value={{ name: props.name }}>
			<Controller {...props} />
		</FormFieldContext.Provider>
	);
};

const useFormField = () => {
	const fieldContext = React.useContext(FormFieldContext);
	const itemContext = React.useContext(FormItemContext);
	const { getFieldState } = useFormContext();
	const formState = useFormState({ name: fieldContext.name });
	const fieldState = getFieldState(fieldContext.name, formState);

	if (!fieldContext) {
		throw new Error("useFormField should be used within <FormField>");
	}

	const { id } = itemContext;

	return {
		id,
		name: fieldContext.name,
		formItemId: `${id}-form-item`,
		formDescriptionId: `${id}-form-item-description`,
		formMessageId: `${id}-form-item-message`,
		...fieldState,
	};
};

type FormItemContextValue = {
	id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
	{} as FormItemContextValue,
);

export type FormItemProps = React.ComponentPropsWithoutRef<"div"> & {
	asChild?: boolean;
};

function FormItem({
	className,
	asChild,
	...props
}: FormItemProps): React.JSX.Element {
	const id = React.useId();

	const Comp = asChild ? Slot : "div";

	return (
		<FormItemContext.Provider value={{ id }}>
			<Comp
				data-slot="form-item"
				className={cn("grid gap-2", className)}
				{...props}
			/>
		</FormItemContext.Provider>
	);
}

export type FormLabelElement = React.ComponentRef<typeof LabelPrimitive.Root>;
export type FormLabelProps = React.ComponentPropsWithoutRef<
	typeof LabelPrimitive.Root
>;

function FormLabel({ className, ...props }: FormLabelProps): React.JSX.Element {
	const { error, formItemId } = useFormField();

	return (
		<Label
			data-slot="form-label"
			data-error={!!error}
			className={cn("data-[error=true]:text-destructive", className)}
			htmlFor={formItemId}
			{...props}
		/>
	);
}

export type FormControlElement = React.ComponentRef<typeof Slot>;
export type FormControlProps = React.ComponentPropsWithoutRef<typeof Slot>;

function FormControl({ ...props }: FormControlProps): React.JSX.Element {
	const { error, formItemId, formDescriptionId, formMessageId } =
		useFormField();

	return (
		<Slot
			data-slot="form-control"
			id={formItemId}
			aria-describedby={
				!error
					? `${formDescriptionId}`
					: `${formDescriptionId} ${formMessageId}`
			}
			aria-invalid={!!error}
			{...props}
		/>
	);
}

export type FormDescriptionProps = React.ComponentPropsWithoutRef<"p"> & {
	asChild?: boolean;
};

function FormDescription({
	className,
	asChild,
	...props
}: FormDescriptionProps): React.JSX.Element {
	const { formDescriptionId } = useFormField();

	const Comp = asChild ? Slot : "p";

	return (
		<Comp
			data-slot="form-description"
			id={formDescriptionId}
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export type FormMessageProps = React.ComponentPropsWithoutRef<"p"> & {
	asChild?: boolean;
};

function FormMessage({
	className,
	asChild,
	...props
}: FormMessageProps): React.JSX.Element | null {
	const { error, formMessageId } = useFormField();
	const body = error ? String(error?.message ?? "") : props.children;

	if (!body) {
		return null;
	}

	const Comp = asChild ? Slot : "p";

	return (
		<Comp
			data-slot="form-message"
			id={formMessageId}
			className={cn("text-destructive text-sm", className)}
			{...props}
		>
			{body}
		</Comp>
	);
}

export {
	useFormField,
	Form,
	FormItem,
	FormLabel,
	FormControl,
	FormDescription,
	FormMessage,
	FormField,
};
