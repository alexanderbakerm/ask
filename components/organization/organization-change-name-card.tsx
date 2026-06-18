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
import { useProgressRouter } from "@/hooks/use-progress-router";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { changeOrganizationNameSchema } from "@/schemas/organization-schemas";
import { trpc } from "@/trpc/client";

/**
 * Card component for changing the organization name.
 * Uses the active organization from session.
 */
export function OrganizationChangeNameCard(): React.JSX.Element {
	const router = useProgressRouter();
	const utils = trpc.useUtils();
	const { data: organization } = authClient.useActiveOrganization();

	const methods = useZodForm({
		schema: changeOrganizationNameSchema,
		values: {
			name: organization?.name ?? "",
		},
	});

	const onSubmit = methods.handleSubmit(async ({ name }) => {
		if (!organization) {
			return;
		}

		try {
			const { error } = await authClient.organization.update({
				organizationId: organization.id,
				data: { name },
			});

			if (error) {
				throw error;
			}

			toast.success("Organization name has been updated.");
			utils.organization.list.invalidate();
			utils.admin.organization.list.invalidate();
			router.refresh();
		} catch {
			toast.error(
				"We were unable to update the organization name. Please try again later.",
			);
		}
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Organization Name</CardTitle>
				<CardDescription>Update your organization's name.</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...methods}>
					<form className="flex flex-col space-y-4" onSubmit={onSubmit}>
						<FormField
							name="name"
							render={({ field }) => (
								<FormItem asChild>
									<Field>
										<FormLabel>Organization Name</FormLabel>
										<FormControl>
											<Input
												placeholder={""}
												required
												autoComplete="organization"
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
								className="w-full md:w-auto"
								disabled={
									!(
										methods.formState.isValid &&
										methods.formState.dirtyFields.name
									)
								}
								loading={methods.formState.isSubmitting}
								type="submit"
							>
								Update Name
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
