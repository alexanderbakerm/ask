import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";
import type * as React from "react";

export type DisputeReceivedEmailProps = {
	appName: string;
	organizationName: string;
	recipientName: string; // Admin name
	amount: string;
	currency: string;
	disputeId: string;
	reason: string;
	evidenceDueBy: string;
	disputeLink: string;
};

function DisputeReceivedEmail({
	appName,
	organizationName,
	recipientName,
	amount,
	currency,
	disputeId,
	reason,
	evidenceDueBy,
	disputeLink,
}: DisputeReceivedEmailProps): React.JSX.Element {
	return (
		<Html>
			<Head />
			<Preview>URGENT: Dispute Received for {organizationName}</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-[#eaeaea] border-solid p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-red-600">
							Action Required: Dispute Received
						</Heading>
						<Text className="text-[14px] text-black leading-[24px]">
							Hello {recipientName},
						</Text>
						<Text className="text-[14px] text-black leading-[24px]">
							A payment dispute (chargeback) has been filed against{" "}
							<strong>{organizationName}</strong>. This means a customer has
							disputed a charge with their bank.
						</Text>
						<Text className="text-[14px] text-black leading-[24px]">
							To avoid losing the funds and incurring a dispute fee, you must
							respond with evidence before the deadline.
						</Text>

						{/* Dispute Details */}
						<Section className="my-[24px] rounded-md border border-[#eaeaea] border-solid bg-[#f9f9f9] p-[16px]">
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Amount:</strong> {amount} {currency.toUpperCase()}
							</Text>
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Reason:</strong> {reason}
							</Text>
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Dispute ID:</strong> {disputeId}
							</Text>
							<Text className="m-0 text-[14px] text-black leading-[24px] text-red-600 font-semibold">
								<strong>Evidence Due By:</strong> {evidenceDueBy}
							</Text>
						</Section>

						<Section className="my-[32px] text-center">
							<Button
								href={disputeLink}
								className="rounded-sm bg-[#dc2626] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
							>
								View & Respond to Dispute
							</Button>
						</Section>

						<Text className="text-[14px] text-black leading-[24px]">
							If you do not respond by the deadline, the dispute will likely be
							lost, and the funds will be permanently withdrawn.
						</Text>

						<Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
						<Text className="text-[#666666] text-[12px] leading-[24px]">
							You receive this email because you are a billing administrator for{" "}
							{organizationName} on {appName}.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

DisputeReceivedEmail.PreviewProps = {
	appName: "Acme",
	organizationName: "Evil Corp",
	recipientName: "Jane Doe",
	amount: "49.00",
	currency: "usd",
	disputeId: "dp_123456789",
	reason: "fraudulent",
	evidenceDueBy: "January 15, 2026",
	disputeLink: "https://dashboard.stripe.com/disputes/dp_123456789",
} satisfies DisputeReceivedEmailProps;

export default DisputeReceivedEmail;
export { DisputeReceivedEmail };
