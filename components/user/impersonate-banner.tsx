"use client";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";

export function ImpersonationBanner(): React.JSX.Element | null {
	const { session } = useSession();
	if (!session?.impersonatedBy) {
		return null;
	}

	const stopImpersonation = async () => {
		await authClient.admin.stopImpersonating();
		window.location.href = "/dashboard/admin/users";
	};

	return (
		<Alert
			className="fixed top-1 right-1 z-[1000] flex h-2 w-full max-w-xs items-center justify-center gap-2 rounded-lg border-0 bg-destructive p-2"
			variant="destructive"
		>
			<AlertTitle className="font-medium text-white text-xs">
				Impersonation Mode
			</AlertTitle>
			<Button
				className="ml-4 h-auto border border-primary-foreground/20 px-2 py-1 font-semibold text-[11px] text-white underline-offset-2"
				onClick={stopImpersonation}
				size="sm"
				type="button"
				variant="link"
			>
				Stop Impersonation
			</Button>
		</Alert>
	);
}
