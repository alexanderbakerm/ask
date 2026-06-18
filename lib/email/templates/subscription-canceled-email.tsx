import {
	Body,
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

export type SubscriptionCanceledEmailProps = {
	appName: string;
	organizationName: string;
	userName: string;
	planName: string;
	cancelDate: string;
	accessEndDate: string;
};

function SubscriptionCanceledEmail({
	appName,
	organizationName,
	userName,
	planName,
	cancelDate,
	accessEndDate,
}: SubscriptionCanceledEmailProps): React.JSX.Element {
	return (
		<Html>
			<Head />
			<Preview>
				Your {planName} subscription for {organizationName} has been canceled
			</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-[#eaeaea] border-solid p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
							Subscription Canceled
						</Heading>
						<Text className="text-[14px] text-black leading-[24px]">
							Hello {userName},
						</Text>
						<Text className="text-[14px] text-black leading-[24px]">
							This email confirms that the subscription for{" "}
							<strong>{organizationName}</strong> has been canceled.
						</Text>

						{/* Cancellation Details */}
						<Section className="my-[24px] rounded-md border border-[#eaeaea] border-solid bg-[#f9f9f9] p-[16px]">
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Plan:</strong> {planName}
							</Text>
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Canceled on:</strong> {cancelDate}
							</Text>
							<Text className="m-0 text-[14px] text-black leading-[24px]">
								<strong>Access until:</strong> {accessEndDate}
							</Text>
						</Section>

						<Text className="text-[14px] text-black leading-[24px]">
							You will continue to have access to all {planName} features until{" "}
							<strong>{accessEndDate}</strong>. After this date, your
							organization will be moved to the free plan.
						</Text>

						<Text className="text-[14px] text-black leading-[24px]">
							If you change your mind, you can reactivate your subscription at
							any time before the access end date from your organization's
							billing settings.
						</Text>

						<Text className="text-[14px] text-black leading-[24px]">
							We're sorry to see you go. If you have any feedback about your
							experience, we'd love to hear from you.
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

SubscriptionCanceledEmail.PreviewProps = {
	appName: "Acme",
	organizationName: "Evil Corp",
	userName: "John Doe",
	planName: "Pro",
	cancelDate: "December 15, 2024",
	accessEndDate: "January 15, 2025",
} satisfies SubscriptionCanceledEmailProps;

export default SubscriptionCanceledEmail;
export { SubscriptionCanceledEmail };
