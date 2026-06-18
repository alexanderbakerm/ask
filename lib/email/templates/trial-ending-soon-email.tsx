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

export type TrialEndingSoonEmailProps = {
	appName: string;
	organizationName: string;
	userName: string;
	planName: string;
	trialEndDate: string;
	daysRemaining: number;
	billingSettingsLink: string;
};

function TrialEndingSoonEmail({
	appName,
	organizationName,
	userName,
	planName,
	trialEndDate,
	daysRemaining,
	billingSettingsLink,
}: TrialEndingSoonEmailProps): React.JSX.Element {
	const daysText = daysRemaining === 1 ? "1 day" : `${daysRemaining} days`;

	return (
		<Html>
			<Head />
			<Preview>
				Your {planName} trial for {organizationName} ends in {daysText}
			</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-[#eaeaea] border-solid p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
							Your Trial is Ending Soon
						</Heading>
						<Text className="text-[14px] text-black leading-[24px]">
							Hello {userName},
						</Text>
						<Text className="text-[14px] text-black leading-[24px]">
							Your free trial of the <strong>{planName}</strong> plan for{" "}
							<strong>{organizationName}</strong> will end in{" "}
							<strong>{daysText}</strong>.
						</Text>

						{/* Trial Details */}
						<Section className="my-[24px] rounded-md border border-[#eaeaea] border-solid bg-[#f9f9f9] p-[16px]">
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Plan:</strong> {planName}
							</Text>
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Trial ends:</strong> {trialEndDate}
							</Text>
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Days remaining:</strong> {daysRemaining}
							</Text>
						</Section>

						<Text className="text-[14px] text-black leading-[24px]">
							To continue enjoying all the features of {planName} without
							interruption, please add a payment method before your trial ends.
							Your subscription will begin automatically once the trial period
							is over.
						</Text>

						<Section className="my-[32px] text-center">
							<Button
								href={billingSettingsLink}
								className="rounded-sm bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
							>
								Add Payment Method
							</Button>
						</Section>

						<Text className="text-[14px] text-black leading-[24px]">
							If you decide not to continue, no action is needed. Your account
							will automatically switch to the free plan at the end of your
							trial.
						</Text>

						<Text className="text-[14px] text-black leading-[24px]">
							Have questions? Reply to this email or contact our support team.
						</Text>

						<Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
						<Text className="text-[#666666] text-[12px] leading-[24px]">
							You received this email because you are a billing administrator
							for {organizationName} on {appName}.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

TrialEndingSoonEmail.PreviewProps = {
	appName: "Acme",
	organizationName: "Evil Corp",
	userName: "John Doe",
	planName: "Pro",
	trialEndDate: "December 20, 2024",
	daysRemaining: 3,
	billingSettingsLink:
		"https://example.com/organization/settings?tab=subscription",
} satisfies TrialEndingSoonEmailProps;

export default TrialEndingSoonEmail;
export { TrialEndingSoonEmail };
