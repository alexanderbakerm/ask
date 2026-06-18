"use client";

import { CheckIcon, XIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { OrganizationLogo } from "@/components/organization/organization-logo";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { authClient } from "@/lib/auth/client";
import { trpc } from "@/trpc/client";

export type OrganizationInvitationModalProps = {
	invitationId: string;
	organizationName: string;
	logoUrl?: string;
};

export function OrganizationInvitationCard({
	invitationId,
	organizationName,
	logoUrl,
}: OrganizationInvitationModalProps): React.JSX.Element {
	const router = useProgressRouter();
	const utils = trpc.useUtils();
	const [submitting, setSubmitting] = React.useState<
		false | "accept" | "reject"
	>(false);

	const onSelectAnswer = async (accept: boolean) => {
		setSubmitting(accept ? "accept" : "reject");
		try {
			if (accept) {
				const { error } = await authClient.organization.acceptInvitation({
					invitationId,
				});

				if (error) {
					throw error;
				}

				await utils.organization.list.invalidate();

				router.replace("/dashboard");
			} else {
				const { error } = await authClient.organization.rejectInvitation({
					invitationId,
				});

				if (error) {
					throw error;
				}

				router.replace("/dashboard");
			}
		} catch (err) {
			const message =
				err && typeof err === "object" && "message" in err
					? String(err.message)
					: "Something went wrong. Please try again.";
			toast.error(message);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Card className="w-full border-transparent px-4 py-8 dark:border-border">
			<CardHeader>
				<CardTitle className="text-center text-base lg:text-lg">
					You've been invited
				</CardTitle>
				<CardDescription className="text-center">
					{organizationName} has invited you to join their organization.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{/* Organization Info */}
				<div className="flex items-center gap-3 rounded-lg border p-3">
					<OrganizationLogo
						className="size-10"
						name={organizationName}
						src={logoUrl}
					/>
					<div>
						<p className="font-semibold text-sm">{organizationName}</p>
						<p className="text-muted-foreground text-xs">Organization</p>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex gap-2">
					<Button
						variant="outline"
						className="flex-1"
						disabled={!!submitting}
						onClick={() => onSelectAnswer(false)}
					>
						{submitting === "reject" ? (
							<span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : (
							<XIcon className="size-4" />
						)}
						Decline
					</Button>
					<Button
						className="flex-1"
						disabled={!!submitting}
						onClick={() => onSelectAnswer(true)}
					>
						{submitting === "accept" ? (
							<span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : (
							<CheckIcon className="size-4" />
						)}
						Accept
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
