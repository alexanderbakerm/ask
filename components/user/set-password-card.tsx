"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";

export function SetPasswordCard(): React.JSX.Element {
	const { user } = useSession();
	const [submitting, setSubmitting] = React.useState(false);

	const onSubmit = async () => {
		if (!user) {
			return;
		}

		setSubmitting(true);

		await authClient.requestPasswordReset(
			{
				email: user.email,
				redirectTo: `${window.location.origin}/auth/reset-password`,
			},
			{
				onSuccess: () => {
					toast.success("Check your inbox for the link to set your password.");
				},
				onError: () => {
					toast.error("Could not send link to set password. Please try again.");
				},
				onResponse: () => {
					setSubmitting(false);
				},
			},
		);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Your Password</CardTitle>
				<CardDescription>
					You have not set a password yet. To set one, you need to go through
					the password reset flow. Click the button below to send an email to
					reset your password and follow the instructions in the email
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div>
					<Button loading={submitting} onClick={onSubmit} type="button">
						Set password
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
