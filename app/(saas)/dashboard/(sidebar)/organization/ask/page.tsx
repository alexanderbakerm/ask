import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { JSX } from "react";
import { AskBiChat } from "@/components/ai/askbi/askbi-chat";
import {
	Page,
	PageBody,
	PageBreadcrumb,
	PageHeader,
	PagePrimaryBar,
} from "@/components/ui/custom/page";
import { getOrganizationById, getSession } from "@/lib/auth/server";

export const metadata: Metadata = {
	title: "AI Chatbot",
};

export default async function AskPage(): Promise<JSX.Element> {
	const session = await getSession();
	if (!session) {
		redirect("/auth/sign-in");
	}

	const activeOrganizationId = session.session.activeOrganizationId;
	if (!activeOrganizationId) {
		redirect("/dashboard");
	}

	let organization: Awaited<ReturnType<typeof getOrganizationById>> | null =
		null;
	try {
		organization = await getOrganizationById(activeOrganizationId);
	} catch {
		redirect("/dashboard");
	}

	if (!organization) {
		redirect("/dashboard");
	}

	return (
		<Page>
			<PageHeader>
				<PagePrimaryBar>
					<PageBreadcrumb
						segments={[
							{ label: "Home", href: "/dashboard" },
							{ label: organization.name, href: "/dashboard/organization" },
							{ label: "AI Chatbot" },
						]}
					/>
				</PagePrimaryBar>
			</PageHeader>
			<PageBody disableScroll className="overflow-hidden p-0">
				<AskBiChat organizationId={organization.id} />
			</PageBody>
		</Page>
	);
}
