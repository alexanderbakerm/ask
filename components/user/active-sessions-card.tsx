"use client";

import NiceModal from "@ebay/nice-modal-react";
import { Loader2Icon, XIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export function ActiveSessionsCard(): React.JSX.Element {
	const router = useProgressRouter();
	const utils = trpc.useUtils();
	const { session: currentSession } = useSession();
	const { data: activeSessions, isPending } =
		trpc.user.getActiveSessions.useQuery();
	const [isRevoking, setIsRevoking] = React.useState<string | null>(null);

	const sortedSessions = React.useMemo(() => {
		if (!activeSessions) return [];
		return [...activeSessions].sort((a, b) => {
			if (a.id === currentSession?.id) return -1;
			if (b.id === currentSession?.id) return 1;
			return 0;
		});
	}, [activeSessions, currentSession?.id]);

	const revokeSession = (token: string) => {
		setIsRevoking(token);
		authClient.revokeSession(
			{
				token,
			},
			{
				onSuccess: async () => {
					toast.success("Session revoked");
					await utils.user.getActiveSessions.invalidate();
					await utils.user.getActiveSessions.refetch();
					router.refresh();
					setIsRevoking(null);
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || "Failed to revoke session");
					setIsRevoking(null);
				},
			},
		);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Active Sessions</CardTitle>
				<CardDescription>
					These are all the active sessions of your account. Click the X to end
					a specifc session.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-2">
					{isPending ? (
						<div className="flex gap-2">
							<Skeleton className="size-6 shrink-0" />
							<div className="flex-1">
								<Skeleton className="mb-0.5 h-4 w-full" />
								<Skeleton className="h-8 w-full" />
							</div>
							<Skeleton className="size-9 shrink-0" />
						</div>
					) : (
						sortedSessions.map((session) => {
							const isCurrent = session.id === currentSession?.id;
							return (
								<div
									className={cn(
										"flex items-center justify-between gap-4 rounded-lg border p-3",
										isCurrent && "opacity-60",
									)}
									key={session.id}
								>
									<div>
										<strong className="block font-medium text-sm">
											{isCurrent ? "Current session" : "Other session"}
										</strong>
										<small className="block text-foreground/60 text-xs leading-tight">
											{session.userAgent} {session.ipAddress}
										</small>
									</div>
									<Button
										className="size-7 shrink-0 shadow-none"
										size="icon"
										type="button"
										variant="outline"
										disabled={isCurrent || isRevoking === session.token}
										onClick={() =>
											NiceModal.show(ConfirmationModal, {
												title: "End Session",
												message:
													"Are you sure you want to end this session? This will instantly log out this device.",
												confirmLabel: "End Session",
												destructive: true,
												onConfirm: () => revokeSession(session.token),
											})
										}
									>
										{isRevoking === session.token ? (
											<Loader2Icon className="size-4 animate-spin" />
										) : (
											<XIcon className="size-4 shrink-0" />
										)}
									</Button>
								</div>
							);
						})
					)}
				</div>
			</CardContent>
		</Card>
	);
}
