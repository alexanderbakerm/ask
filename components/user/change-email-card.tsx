"use client";

import type * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { changeEmailSchema } from "@/schemas/user-schemas";

export function ChangeEmailCard(): React.JSX.Element {
	const { user, reloadSession } = useSession();

	const methods = useZodForm({
		schema: changeEmailSchema,
		defaultValues: {
			email: "",
		},
	});

	const onSubmit = methods.handleSubmit(async ({ email }) => {
		const { error } = await authClient.changeEmail({
			newEmail: email,
		});

		if (error) {
			toast.error(error.message || "Could not update email");
			return;
		}

		toast.success(
			"A confirmation link was sent to your current email. Please verify this change.",
		);

		reloadSession();
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Update your Email</CardTitle>
				<CardDescription>
					Update your email address you use to login to your account.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...methods}>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							onSubmit();
						}}
					>
						<Field data-disabled="true">
							<FormLabel>Current Email</FormLabel>
							<Input type="email" disabled value={user?.email ?? ""} />
						</Field>
						<FormField
							name="email"
							render={({ field }) => (
								<FormItem asChild>
									<Field>
										<FormLabel>New Email</FormLabel>
										<FormControl>
											<Input
												required
												type="email"
												placeholder={""}
												autoComplete="email"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</Field>
								</FormItem>
							)}
						/>
						<div>
							<Button
								type="submit"
								loading={methods.formState.isSubmitting}
								disabled={
									!(
										methods.formState.isValid &&
										methods.formState.dirtyFields.email
									)
								}
							>
								Update Email Address
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
