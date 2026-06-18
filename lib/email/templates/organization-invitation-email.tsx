import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type * as React from "react";

export type OrganizationInvitationEmailProps = {
	appName: string;
	invitedByName: string;
	invitedByEmail: string;
	organizationName: string;
	inviteLink: string;
};

function OrganizationInvitationEmail({
	appName,
	invitedByName,
	invitedByEmail,
	organizationName,
	inviteLink,
}: OrganizationInvitationEmailProps): React.JSX.Element {
	return (
		<Html>
			<Head />
			<Preview>
				Join {organizationName} on {appName}
			</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-[#eaeaea] border-solid p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
							Join <strong>{organizationName}</strong> on{" "}
							<strong>{appName}</strong>
						</Heading>
						<Text className="text-[14px] text-black leading-[24px]">
							Hello,
						</Text>
						<Text className="text-[14px] text-black leading-[24px]">
							<strong>{invitedByName}</strong> (
							<Link
								href={`mailto:${invitedByEmail}`}
								className="break-all text-blue-600 no-underline"
							>
								{invitedByEmail}
							</Link>
							) has invited you to join the <strong>{organizationName}</strong>{" "}
							organization on <strong>{appName}</strong>.
						</Text>
						<Section className="my-[32px] text-center">
							<Button
								href={inviteLink}
								className="rounded-sm bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
							>
								Accept
							</Button>
						</Section>
						<Text className="text-[14px] text-black leading-[24px]">
							or copy and paste this URL into your browser:{" "}
							<Link
								href={inviteLink}
								className="break-all text-blue-600 no-underline"
							>
								{inviteLink}
							</Link>
						</Text>
						<Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
						<Text className="text-[#666666] text-[12px] leading-[24px]">
							If you were not expecting this invitation, you can ignore this
							email.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

OrganizationInvitationEmail.PreviewProps = {
	appName: "Acme",
	invitedByName: "Jane Doe",
	invitedByEmail: "jane.doe@gmail.com",
	organizationName: "Evil Corp",
	inviteLink:
		"https://example.com/invitations/request/a5cffa7e-76eb-4671-a195-d1670a7d4df3",
} satisfies OrganizationInvitationEmailProps;

export default OrganizationInvitationEmail;
export { OrganizationInvitationEmail };
