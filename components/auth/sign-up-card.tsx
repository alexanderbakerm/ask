"use client";

import { LockIcon, MailIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { withQuery } from "ufo";
import { PasswordFormMessage } from "@/components/auth/password-form-message";
import { SocialSigninButton } from "@/components/auth/social-signin-button";
import { OrganizationInvitationAlert } from "@/components/invitations/organization-invitation-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { InputPassword } from "@/components/ui/custom/input-password";
import { TurnstileCaptcha } from "@/components/ui/custom/turnstile";
import { Field } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { authConfig } from "@/config/auth.config";
import { useTurnstile } from "@/hooks/use-turnstile";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import {
	CAPTCHA_RESPONSE_HEADER,
	getAuthErrorMessage,
} from "@/lib/auth/constants";
import { type OAuthProvider, oAuthProviders } from "@/lib/auth/oauth-providers";
import { signUpSchema } from "@/schemas/auth-schemas";

export function SignUpCard({ prefillEmail }: { prefillEmail?: string }) {
	const searchParams = useSearchParams();

	const {
		turnstileRef,
		captchaToken,
		captchaEnabled,
		resetCaptcha,
		handleSuccess,
		handleError,
		handleExpire,
	} = useTurnstile();

	const invitationId = searchParams.get("invitationId");
	const emailParam = searchParams.get("email");
	const redirectTo = searchParams.get("redirectTo");

	const methods = useZodForm({
		schema: signUpSchema,
		values: {
			name: "",
			email: prefillEmail ?? emailParam ?? "",
			password: "",
		},
	});

	const redirectPath = invitationId
		? `/dashboard/organization-invitation/${invitationId}`
		: (redirectTo ?? authConfig.redirectAfterSignIn);

	const onSubmit = methods.handleSubmit(async ({ email, password, name }) => {
		try {
			const { error } = await authClient.signUp.email({
				email,
				password,
				name,
				callbackURL: redirectPath,
				fetchOptions: captchaEnabled
					? {
							headers: {
								[CAPTCHA_RESPONSE_HEADER]: captchaToken,
							},
						}
					: undefined,
			});
			if (error) {
				throw error;
			}
		} catch (e) {
			resetCaptcha();
			methods.setError("root", {
				message: getAuthErrorMessage(
					e && typeof e === "object" && "code" in e
						? (e.code as string)
						: undefined,
				),
			});
		}
	});

	return (
		<Card className="w-full border-transparent px-4 py-8 dark:border-border">
			<CardHeader>
				<CardTitle className="text-base lg:text-lg">
					Create your account
				</CardTitle>
				<CardDescription>
					Please fill in the details to get started.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{methods.formState.isSubmitSuccessful ? (
					<Alert variant="info">
						<AlertDescription>
							We have sent you a link to verify your email. Please check your
							inbox.
						</AlertDescription>
					</Alert>
				) : (
					<>
						{invitationId && <OrganizationInvitationAlert className="mb-6" />}
						<Form {...methods}>
							<form
								className="flex flex-col items-stretch gap-4"
								onSubmit={onSubmit}
							>
								<FormField
									control={methods.control}
									name="name"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Name</FormLabel>
												<FormControl>
													<InputGroup
														className={field.disabled ? "opacity-50" : ""}
													>
														<InputGroupAddon align="inline-start">
															<InputGroupText>
																<UserIcon className="size-4 shrink-0" />
															</InputGroupText>
														</InputGroupAddon>
														<InputGroupInput
															autoComplete="name"
															disabled={methods.formState.isSubmitting}
															maxLength={64}
															type="text"
															{...field}
														/>
													</InputGroup>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
								<FormField
									control={methods.control}
									name="email"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Email</FormLabel>
												<FormControl>
													<InputGroup
														className={field.disabled ? "opacity-50" : ""}
													>
														<InputGroupAddon align="inline-start">
															<InputGroupText>
																<MailIcon className="size-4 shrink-0" />
															</InputGroupText>
														</InputGroupAddon>
														<InputGroupInput
															autoComplete="username"
															disabled={methods.formState.isSubmitting}
															maxLength={255}
															type="email"
															{...field}
														/>
													</InputGroup>
												</FormControl>
												<FormMessage />
											</Field>
										</FormItem>
									)}
								/>
								<FormField
									control={methods.control}
									name="password"
									render={({ field }) => (
										<FormItem asChild>
											<Field>
												<FormLabel>Password</FormLabel>
												<FormControl>
													<InputPassword
														autoCapitalize="off"
														autoComplete="current-password"
														disabled={methods.formState.isSubmitting}
														maxLength={72}
														startAdornment={
															<LockIcon className="size-4 shrink-0" />
														}
														{...field}
													/>
												</FormControl>
												<PasswordFormMessage
													password={methods.watch("password")}
												/>
											</Field>
										</FormItem>
									)}
								/>
								{captchaEnabled && (
									<TurnstileCaptcha
										ref={turnstileRef}
										onSuccess={handleSuccess}
										onError={handleError}
										onExpire={handleExpire}
									/>
								)}
								{methods.formState.isSubmitted &&
									methods.formState.errors.root && (
										<Alert variant="destructive">
											<AlertDescription>
												{methods.formState.errors.root.message}
											</AlertDescription>
										</Alert>
									)}
								<Button
									className="w-full"
									disabled={
										methods.formState.isSubmitting ||
										(captchaEnabled && !captchaToken)
									}
									loading={methods.formState.isSubmitting}
									type="submit"
								>
									Create account
								</Button>
							</form>
						</Form>

						{authConfig.enableSignup && authConfig.enableSocialLogin && (
							<>
								<div className="relative my-1 h-4">
									<hr className="relative top-2" />
									<p className="-translate-x-1/2 absolute top-0 left-1/2 mx-auto inline-block h-4 bg-card px-2 text-center font-medium text-foreground/60 text-sm leading-tight">
										Or continue with
									</p>
								</div>
								<div className="grid grid-cols-1 items-stretch gap-2">
									{Object.keys(oAuthProviders).map((providerId) => (
										<SocialSigninButton
											key={providerId}
											provider={providerId as OAuthProvider}
										/>
									))}
								</div>
							</>
						)}
					</>
				)}
			</CardContent>
			<CardFooter className="flex justify-center gap-1 text-muted-foreground text-sm">
				<span>Already have an account?</span>
				<Link
					className="text-foreground underline"
					href={withQuery(
						"/auth/sign-in",
						Object.fromEntries(searchParams.entries()),
					)}
				>
					Sign in
				</Link>
			</CardFooter>
		</Card>
	);
}
