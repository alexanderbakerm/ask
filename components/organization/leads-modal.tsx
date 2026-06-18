"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import {
	LeadSource,
	LeadSources,
	LeadStatus,
	LeadStatuses,
} from "@/lib/db/schema/enums";
import { capitalize } from "@/lib/utils";
import {
	createLeadSchema,
	updateLeadSchema,
} from "@/schemas/organization-lead-schemas";
import { trpc } from "@/trpc/client";

export type LeadsModalProps = NiceModalHocProps & {
	lead?: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		phone?: string | null;
		company?: string | null;
		jobTitle?: string | null;
		status: string;
		source: string;
		estimatedValue?: number | null;
		notes?: string | null;
		assignedToId?: string | null;
	};
};

export const LeadsModal = NiceModal.create<LeadsModalProps>(({ lead }) => {
	const modal = useEnhancedModal();
	const utils = trpc.useUtils();
	const isEditing = !!lead;

	const createLeadMutation = trpc.organization.lead.create.useMutation({
		onSuccess: () => {
			toast.success("Lead created successfully");
			utils.organization.lead.list.invalidate();
			modal.handleClose();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create lead");
		},
	});

	const updateLeadMutation = trpc.organization.lead.update.useMutation({
		onSuccess: () => {
			toast.success("Lead updated successfully");
			utils.organization.lead.list.invalidate();
			modal.handleClose();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update lead");
		},
	});

	const form = useZodForm({
		schema: isEditing ? updateLeadSchema : createLeadSchema,
		defaultValues: isEditing
			? {
					id: lead.id,
					firstName: lead.firstName,
					lastName: lead.lastName,
					email: lead.email,
					phone: lead.phone ?? "",
					company: lead.company ?? "",
					jobTitle: lead.jobTitle ?? "",
					status: lead.status as LeadStatus,
					source: lead.source as LeadSource,
					estimatedValue: lead.estimatedValue ?? undefined,
					notes: lead.notes ?? "",
				}
			: {
					firstName: "",
					lastName: "",
					email: "",
					phone: "",
					company: "",
					jobTitle: "",
					status: LeadStatus.new,
					source: LeadSource.other,
					estimatedValue: undefined,
					notes: "",
				},
	});

	const onSubmit = form.handleSubmit((data) => {
		if (isEditing) {
			updateLeadMutation.mutate(
				data as Parameters<typeof updateLeadMutation.mutate>[0],
			);
		} else {
			createLeadMutation.mutate(
				data as Parameters<typeof createLeadMutation.mutate>[0],
			);
		}
	});

	const isPending =
		createLeadMutation.isPending || updateLeadMutation.isPending;

	return (
		<Sheet
			open={modal.visible}
			onOpenChange={(open) => !open && modal.handleClose()}
		>
			<SheetContent
				className="sm:max-w-lg"
				onAnimationEndCapture={modal.handleAnimationEndCapture}
			>
				<SheetHeader>
					<SheetTitle>{isEditing ? "Edit Lead" : "Create Lead"}</SheetTitle>
					<SheetDescription className="sr-only">
						{isEditing
							? "Update the lead information below."
							: "Fill in the details to create a new lead."}
					</SheetDescription>
				</SheetHeader>

				<Form {...form}>
					<form
						onSubmit={onSubmit}
						className="flex flex-1 flex-col overflow-hidden"
					>
						<ScrollArea className="flex-1">
							<div className="space-y-4 px-6 py-4">
								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="firstName"
										render={({ field }) => (
											<FormItem asChild>
												<Field>
													<FormLabel>First Name</FormLabel>
													<FormControl>
														<Input
															placeholder="John"
															autoComplete="off"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</Field>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="lastName"
										render={({ field }) => (
											<FormItem asChild>
												<Field>
													<FormLabel>Last Name</FormLabel>
													<FormControl>
														<Input
															placeholder="Doe"
															autoComplete="off"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</Field>
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="email"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Email</FormLabel>
												<FormControl>
													<Input
														type="email"
														placeholder="john.doe@example.com"
														autoComplete="off"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="phone"
										render={({ field }) => (
											<FormItem asChild>
												<Field>
													<FormLabel>Phone</FormLabel>
													<FormControl>
														<Input
															placeholder="+1 (555) 123-4567"
															autoComplete="off"
															{...field}
															value={field.value ?? ""}
														/>
													</FormControl>
													<FormMessage />
												</Field>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="company"
										render={({ field }) => (
											<FormItem asChild>
												<Field>
													<FormLabel>Company</FormLabel>
													<FormControl>
														<Input
															placeholder="Acme Inc."
															autoComplete="off"
															{...field}
															value={field.value ?? ""}
														/>
													</FormControl>
													<FormMessage />
												</Field>
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="jobTitle"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Job Title</FormLabel>
												<FormControl>
													<Input
														placeholder="Marketing Manager"
														autoComplete="off"
														{...field}
														value={field.value ?? ""}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="status"
										render={({ field }) => (
											<FormItem asChild>
												<Field>
													<FormLabel>Status</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger className="w-full">
																<SelectValue placeholder="Select status" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{LeadStatuses.map((status) => (
																<SelectItem key={status} value={status}>
																	{capitalize(status.replace("_", " "))}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</Field>
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="source"
										render={({ field }) => (
											<FormItem asChild>
												<Field>
													<FormLabel>Source</FormLabel>
													<Select
														onValueChange={field.onChange}
														defaultValue={field.value}
													>
														<FormControl>
															<SelectTrigger className="w-full">
																<SelectValue placeholder="Select source" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{LeadSources.map((source) => (
																<SelectItem key={source} value={source}>
																	{capitalize(source.replace("_", " "))}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</Field>
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="estimatedValue"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Estimated Value ($)</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="10000"
														autoComplete="off"
														{...field}
														value={field.value ?? ""}
														onChange={(e) =>
															field.onChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															)
														}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="notes"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Notes</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Additional notes about this lead..."
														className="resize-none"
														rows={3}
														{...field}
														value={field.value ?? ""}
													/>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
							</div>
						</ScrollArea>

						<SheetFooter className="flex-row justify-end gap-2 border-t">
							<Button
								type="button"
								variant="outline"
								onClick={modal.handleClose}
								disabled={isPending}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending} loading={isPending}>
								{isEditing ? "Update Lead" : "Create Lead"}
							</Button>
						</SheetFooter>
					</form>
				</Form>
			</SheetContent>
		</Sheet>
	);
});
