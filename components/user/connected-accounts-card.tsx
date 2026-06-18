"use client";

import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";
import { type OAuthProvider, oAuthProviders } from "@/lib/auth/oauth-providers";
import { trpc } from "@/trpc/client";

export function ConnectedAccountsCard(): React.JSX.Element {
	const { data, isPending } = trpc.user.getAccounts.useQuery();

	const isProviderLinked = (provider: OAuthProvider) =>
		data?.some((account) => account.providerId === provider);

	const connect = (provider: OAuthProvider) => {
		const callbackURL = window.location.href;
		if (!isProviderLinked(provider)) {
			authClient.linkSocial({
				provider,
				callbackURL,
			});
		}
	};

	const disconnect = (provider: OAuthProvider) => {
		if (isProviderLinked(provider)) {
			authClient.unlinkAccount({
				providerId: provider,
			});
		}
	};

	const isLastAccount = (data?.length || 0) === 1;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Connected accounts</CardTitle>
				<CardDescription>
					Sign in faster to your account by linking it to Google.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-3">
					{Object.entries(oAuthProviders).map(([provider, providerData]) => {
						const isLinked = isProviderLinked(provider as OAuthProvider);
						return (
							<div
								key={provider}
								className="flex items-center justify-between gap-3 rounded-lg border p-4"
							>
								<div className="flex items-center gap-3">
									<providerData.icon className="size-5 text-primary/50" />
									<span className="font-medium text-sm">
										{providerData.name}
									</span>
								</div>
								{isPending ? (
									<Skeleton className="h-10 w-28" />
								) : (
									<Button
										variant="outline"
										disabled={isLinked && isLastAccount}
										onClick={() =>
											isLinked
												? disconnect(provider as OAuthProvider)
												: connect(provider as OAuthProvider)
										}
									>
										{isLinked ? "Disconnect" : "Connect"}
									</Button>
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
