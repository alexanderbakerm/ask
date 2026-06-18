import type * as React from "react";
import {
	Alert,
	AlertDescription,
	type AlertProps,
	AlertTitle,
} from "@/components/ui/alert";

export type OrganizationInvitationAlertProps = Omit<AlertProps, "variant">;

export function OrganizationInvitationAlert(
	props: OrganizationInvitationAlertProps,
): React.JSX.Element {
	return (
		<Alert variant="info" {...props}>
			<AlertTitle>You have been invited to join an organization.</AlertTitle>
			<AlertDescription>
				You need to sign in or create an account to join the organization.
			</AlertDescription>
		</Alert>
	);
}
