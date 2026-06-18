"use client";

import { CircleCheck, XCircleIcon } from "lucide-react";
import type * as React from "react";
import { useFormField } from "@/components/ui/form";
import { authConfig } from "@/config/auth.config";
import { passwordValidator } from "@/lib/auth/utils";
import { cn } from "@/lib/utils";

export type PasswordFormMessageProps = {
	password?: string | null;
};

export function PasswordFormMessage({
	password,
}: PasswordFormMessageProps): React.JSX.Element {
	const { error, formMessageId } = useFormField();

	const containsLowerAndUpperCase =
		passwordValidator.containsLowerAndUpperCase(password);
	const hasMinimumLength = passwordValidator.hasMinimumLength(password);
	const containsNumber = passwordValidator.containsNumber(password);
	const isPasswordValid =
		containsLowerAndUpperCase && hasMinimumLength && containsNumber;

	const getRequirementToShow = () => {
		if (isPasswordValid) {
			return {
				met: true,
				text: "All requirements met",
			};
		}
		if (!hasMinimumLength) {
			return {
				met: false,
				text: `${authConfig.minimumPasswordLength} or more characters`,
			};
		}
		if (!containsLowerAndUpperCase) {
			return {
				met: false,
				text: "Uppercase and lowercase letters",
			};
		}
		return {
			met: false,
			text: "At least one number",
		};
	};

	const requirement = getRequirementToShow();

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 px-1 font-medium text-[0.8rem]",
				requirement.met
					? "text-green-500"
					: error
						? "text-destructive"
						: "text-muted-foreground",
			)}
			id={formMessageId}
		>
			{requirement.met ? (
				<CircleCheck className="h-3.5 w-3.5 shrink-0" />
			) : (
				<XCircleIcon className="h-3.5 w-3.5 shrink-0" />
			)}
			<p>{requirement.text}</p>
		</div>
	);
}
