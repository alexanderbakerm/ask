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
import { changeNameSchema } from "@/schemas/user-schemas";

export function ChangeNameCard(): React.JSX.Element {
	const { user, reloadSession } = useSession();

	const methods = useZodForm({
		schema: changeNameSchema,
		values: {
			name: user?.name ?? "",
		},
	});

	const onSubmit = methods.handleSubmit(async ({ name }) => {
		const { error } = await authClient.updateUser({
			name,
		});

		if (error) {
			toast.error("Could not update name");
			return;
		}

		toast.success("Name was updated successfully");

		reloadSession();

		methods.reset({
			name,
		});
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Update your Name</CardTitle>
				<CardDescription>
					Update your name to be displayed on your profile.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...methods}>
					<form className="space-y-4" onSubmit={onSubmit}>
						<FormField
							name="name"
							render={({ field }) => (
								<FormItem asChild>
									<Field>
										<FormLabel>Your Name</FormLabel>
										<FormControl>
											<Input
												placeholder={""}
												required
												type="text"
												autoComplete="name"
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
								disabled={
									!(
										methods.formState.isValid &&
										methods.formState.dirtyFields.name
									)
								}
								loading={methods.formState.isSubmitting}
								type="submit"
							>
								Update Profile
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
