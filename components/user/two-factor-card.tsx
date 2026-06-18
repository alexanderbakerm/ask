"use client";

import NiceModal from "@ebay/nice-modal-react";
import { ShieldCheck, ShieldCheckIcon } from "lucide-react";
import type * as React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TwoFactorModal } from "@/components/user/two-factor-modal";
import { useSession } from "@/hooks/use-session";
import { trpc } from "@/trpc/client";

export type TwoFactorCardProps = {
	hasCredentialAccount?: boolean;
};

export function TwoFactorCard({
	hasCredentialAccount,
}: TwoFactorCardProps): React.JSX.Element | null {
	const { user } = useSession();

	const { data: accounts, isLoading } = trpc.user.getAccounts.useQuery(
		undefined,
		{
			enabled: hasCredentialAccount === undefined,
		},
	);

	const isCredentialAccount =
		hasCredentialAccount ??
		accounts?.some((account) => account.providerId === "credential");

	if (isCredentialAccount === false) {
		return null;
	}

	if (isCredentialAccount === undefined && isLoading) {
		return <Skeleton className="h-[218px] w-full" />;
	}

	const handleShowTwoFactorModal = () => {
		NiceModal.show(TwoFactorModal);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Two-factor Authentication</CardTitle>
				<CardDescription>
					Set up Two-factor Authentication method to further secure your
					account.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{user?.twoFactorEnabled ? (
					<div className="flex flex-col items-start gap-4">
						<Alert variant="success">
							<ShieldCheckIcon className="size-4 shrink-0 text-green-500" />
							<AlertDescription>
								You have two-factor authentication enabled for your account.
							</AlertDescription>
						</Alert>
						<Button
							type="button"
							variant="default"
							onClick={handleShowTwoFactorModal}
						>
							Disable Two-factor Authentication
						</Button>
					</div>
				) : (
					<div className="flex flex-col items-start gap-4">
						<Alert>
							<ShieldCheck className="size-4 shrink-0" />
							<AlertDescription>
								Secure your account with an extra layer of security.
							</AlertDescription>
						</Alert>
						<div className="flex justify-start">
							<Button
								type="button"
								variant="default"
								onClick={handleShowTwoFactorModal}
							>
								Set up a new Factor
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
