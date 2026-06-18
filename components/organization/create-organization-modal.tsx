"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { logger } from "@/lib/logger";
import { createOrganizationFormSchema } from "@/schemas/organization-schemas";
import { trpc } from "@/trpc/client";
import { clearOrganizationScopedQueries } from "@/trpc/query-client";

export type CreateOrganizationModalProps = NiceModalHocProps;

export const CreateOrganizationModal =
	NiceModal.create<CreateOrganizationModalProps>(() => {
		const modal = useEnhancedModal();
		const router = useProgressRouter();
		const queryClient = useQueryClient();
		const utils = trpc.useUtils();
		const createOrganizationMutation = trpc.organization.create.useMutation();

		const form = useZodForm({
			schema: createOrganizationFormSchema,
			defaultValues: {
				name: "",
			},
		});

		const onSubmit = form.handleSubmit(async ({ name }) => {
			try {
				const newOrganization = await createOrganizationMutation.mutateAsync({
					name,
				});

				if (!newOrganization) {
					throw new Error("Failed to create organization");
				}

				// Invalidate the organizations list query to ensure the UI updates
				// (e.g., in OrganizationSwitcher and OrganizationsGrid)
				await utils.organization.list.invalidate();

				// Set the new organization as active in the session
				await authClient.organization.setActive({
					organizationId: newOrganization.id,
				});

				// Clear only organization-scoped queries to prevent stale data from previous org
				// while preserving user-level queries (like organizations list) to avoid flickering
				// This is consistent with organization-switcher.tsx and organizations-grid.tsx
				clearOrganizationScopedQueries(queryClient);

				router.replace("/dashboard/organization");

				modal.handleClose();
			} catch (e) {
				logger.error(e);
				toast.error("Could not save the organization. Please try again later.");
			}
		});

		return (
			<Form {...form}>
				<Dialog open={modal.visible}>
					<DialogContent
						className="max-w-lg"
						onAnimationEndCapture={modal.handleAnimationEndCapture}
						onClose={modal.handleClose}
					>
						<DialogHeader>
							<DialogTitle>Create Organization</DialogTitle>
							<DialogDescription>
								You can add members after creating the organization.{" "}
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={onSubmit}>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>Organization Name</FormLabel>
											<FormControl>
												<Input {...field} autoComplete="organization" />
											</FormControl>
											<FormDescription>
												Your organization name should be unique and descriptive
											</FormDescription>
											<FormMessage />
										</Field>
									</FormItem>
								)}
							/>
							<DialogFooter className="mt-4">
								<Button
									disabled={form.formState.isSubmitting}
									onClick={modal.handleClose}
									type="button"
									variant="outline"
								>
									Cancel
								</Button>
								<Button
									disabled={form.formState.isSubmitting}
									loading={form.formState.isSubmitting}
									type="submit"
									variant="default"
								>
									Create Organization
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</Form>
		);
	});
