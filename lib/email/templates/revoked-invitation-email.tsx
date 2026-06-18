import {
	Body,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type * as React from "react";

export type RevokedInvitationEmailProps = {
	appName: string;
	organizationName: string;
};

function RevokedInvitationEmail({
	appName,
	organizationName,
}: RevokedInvitationEmailProps): React.JSX.Element {
	return (
		<Html>
			<Head />
			<Preview>
				Invitation for {organizationName} on {appName} revoked
			</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-[#eaeaea] border-solid p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
							Invitation for <strong>{organizationName}</strong> on{" "}
							<strong>{appName}</strong> revoked
						</Heading>
						<Text className="text-[14px] text-black leading-[24px]">
							Hello,
						</Text>
						<Text className="text-[14px] text-black leading-[24px]">
							Your invitation to join <strong>{organizationName}</strong> has
							been revoked.
						</Text>
						<Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
						<Text className="text-[#666666] text-[12px] leading-[24px]">
							If the revocation was unexpected, ask an admin on the organization
							to send you a new invitation link.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

RevokedInvitationEmail.PreviewProps = {
	appName: "Acme",
	organizationName: "Evil Corp",
} satisfies RevokedInvitationEmailProps;

export default RevokedInvitationEmail;
export { RevokedInvitationEmail };
