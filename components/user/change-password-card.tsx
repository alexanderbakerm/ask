"use client";

import type * as React from "react";
import { toast } from "sonner";
import { PasswordFormMessage } from "@/components/auth/password-form-message";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { InputPassword } from "@/components/ui/custom/input-password";
import { Field } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { changePasswordFormSchema } from "@/schemas/user-schemas";

export function ChangePasswordCard(): React.JSX.Element {
	const router = useProgressRouter();

	const methods = useZodForm({
		schema: changePasswordFormSchema,
		defaultValues: {
			currentPassword: "",
			newPassword: "",
		},
	});

	const onSubmit = methods.handleSubmit(async (values) => {
		const { error } = await authClient.changePassword({
			...values,
			revokeOtherSessions: true,
		});

		if (error) {
			toast.error("Could not update password");
			return;
		}

		toast.success("Password was updated successfully");
		methods.reset({});
		router.refresh();
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Update your Password</CardTitle>
				<CardDescription>
					Update your password to keep your account secure.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...methods}>
					<form onSubmit={onSubmit}>
						<div className="grid grid-cols-1 gap-4">
							<FormField
								control={methods.control}
								name="currentPassword"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Current password</FormLabel>
											<FormControl>
												<InputPassword
													autoComplete="current-password"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</Field>
									</FormItem>
								)}
							/>
							<FormField
								control={methods.control}
								name="newPassword"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>New password</FormLabel>
											<FormControl>
												<InputPassword autoComplete="new-password" {...field} />
											</FormControl>
											<PasswordFormMessage
												password={methods.watch("newPassword")}
											/>
										</Field>
									</FormItem>
								)}
							/>
							<div>
								<Button
									disabled={
										!(
											methods.formState.isValid &&
											Object.keys(methods.formState.dirtyFields).length
										)
									}
									loading={methods.formState.isSubmitting}
									type="submit"
								>
									Update Password
								</Button>
							</div>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
