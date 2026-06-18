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

export type PasswordResetEmailProps = {
	appName: string;
	name: string;
	resetPasswordLink: string;
};

function PasswordResetEmail({
	appName,
	name,
	resetPasswordLink,
}: PasswordResetEmailProps): React.JSX.Element {
	return (
		<Html>
			<Head />
			<Preview>{appName} reset your password</Preview>
			<Tailwind>
				<Body className="m-auto bg-white px-2 font-sans">
					<Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-[#eaeaea] border-solid p-[20px]">
						<Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
							Reset Instructions
						</Heading>
						<Text className="text-[14px] text-black leading-[24px]">
							Hello {name},
						</Text>
						<Text className="text-[14px] text-black leading-[24px]">
							Someone recently requested a password change for your {appName}{" "}
							account. If this was you, you can set a new password here:
						</Text>
						<Section className="my-[32px] text-center">
							<Button
								className="rounded-sm bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
								href={resetPasswordLink}
							>
								Reset password
							</Button>
						</Section>
						<Text className="text-[14px] text-black leading-[24px]">
							or copy and paste this URL into your browser:{" "}
							<Link
								href={resetPasswordLink}
								className="break-all text-blue-600 no-underline"
							>
								{resetPasswordLink}
							</Link>
						</Text>
						<Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
						<Text className="text-[#666666] text-[12px] leading-[24px]">
							If you don't want to change your password or didn't request this,
							just ignore and delete this message. To keep your account secure,
							please don't forward this email to anyone.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

PasswordResetEmail.PreviewProps = {
	appName: "Acme",
	name: "John Doe",
	resetPasswordLink:
		"https://example.com/reset-password/request/a5cffa7e-76eb-4671-a195-d1670a7d4df3",
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
export { PasswordResetEmail };
