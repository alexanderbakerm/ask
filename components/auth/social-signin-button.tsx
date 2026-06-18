"use client";

import { parseAsString, useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { authConfig } from "@/config/auth.config";
import { authClient } from "@/lib/auth/client";
import { oAuthProviders } from "@/lib/auth/oauth-providers";
import { cn } from "@/lib/utils";

export type SocialSigninButtonProps =
	React.ButtonHTMLAttributes<HTMLButtonElement> & {
		provider: keyof typeof oAuthProviders;
	};

export function SocialSigninButton({
	provider,
	className,
	...props
}: SocialSigninButtonProps): React.JSX.Element {
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/app/organization-invitation/${invitationId}`
		: authConfig.redirectAfterSignIn;

	const onSignin = () => {
		const callbackURL = new URL(redirectPath, window.location.origin);
		authClient.signIn.social({
			provider,
			callbackURL: callbackURL.toString(),
		});
	};

	return (
		<Button
			{...props}
			onClick={() => onSignin()}
			type="button"
			variant="outline"
			className={cn("w-full gap-2", className)}
		>
			{providerData.icon && <providerData.icon className="size-4 shrink-0" />}
			<span>{providerData.name}</span>
		</Button>
	);
}
