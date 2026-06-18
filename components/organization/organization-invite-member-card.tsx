"use client";

import type * as React from "react";
import { toast } from "sonner";
import { OrganizationRoleSelect } from "@/components/organization/organization-role-select";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { inviteMemberSchema } from "@/schemas/organization-schemas";

/**
 * Card component for inviting members to the organization.
 * Uses the active organization from session.
 */
export function OrganizationInviteMemberCard(): React.JSX.Element {
	const { data: organization } = authClient.useActiveOrganization();

	const methods = useZodForm({
		schema: inviteMemberSchema,
		defaultValues: {
			email: "",
			role: "member" as const,
		},
	});

	const onSubmit = methods.handleSubmit(async (values) => {
		if (!organization) return;

		try {
			// Better Auth uses the active organization from session when organizationId is not provided
			const { error } = await authClient.organization.inviteMember({
				...values,
				organizationId: organization.id,
			});

			if (error) {
				if (error.code === "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION") {
					toast.error("User is already invited to this organization.");
					return;
				}
				if (error.code === "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION") {
					toast.error("User is already a member of this organization.");
					return;
				}
				// Check for member limit errors - the code is dynamically generated from the message
				// so we check both the code pattern and the status
				if (
					error.code === "FORBIDDEN" ||
					error.status === 403 ||
					error.code?.includes("MAXIMUM_NUMBER_OF_TEAM_MEMBERS")
				) {
					toast.error(
						error.message ||
							"You have reached the member limit for your plan. Please upgrade to invite more members.",
					);
					return;
				}
				throw error;
			}

			methods.reset();
			toast.success("Invitation sent successfully.");
		} catch (err) {
			// Handle any thrown errors that have a message
			const message =
				err && typeof err === "object" && "message" in err
					? String(err.message)
					: "Something went wrong. Please try again.";
			toast.error(message);
		}
	});

	return (
		<Card>
			<CardHeader className="flex flex-row justify-between">
				<div className="flex flex-col space-y-1.5">
					<CardTitle>Invite Member</CardTitle>
					<CardDescription>
						Send an invite to a team mate by email and assign them a role.
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				<Form {...methods}>
					<form onSubmit={onSubmit} className="@container">
						<FieldGroup className="flex @md:flex-row flex-col gap-2">
							<div className="flex-1">
								<FormField
									control={methods.control}
									name="email"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Email address</FormLabel>
												<FormControl>
													<Input type="email" autoComplete="email" {...field} />
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							</div>
							<div>
								<FormField
									control={methods.control}
									name="role"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Role</FormLabel>
												<FormControl>
													<OrganizationRoleSelect
														value={field.value ?? "member"}
														onSelect={field.onChange}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							</div>
						</FieldGroup>
						<div className="mt-4">
							<Button type="submit" loading={methods.formState.isSubmitting}>
								Send Invite
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
