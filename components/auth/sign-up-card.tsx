"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { withQuery } from "ufo";
import {
	AuthDivider,
	AuthGoogleButton,
	AuthPageShell,
	AuthPasswordToggle,
	GlassInputWrapper,
} from "@/components/auth/auth-page-shell";
import { PasswordFormMessage } from "@/components/auth/password-form-message";
import { OrganizationInvitationAlert } from "@/components/invitations/organization-invitation-alert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TurnstileCaptcha } from "@/components/ui/custom/turnstile";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { authConfig } from "@/config/auth.config";
import { useTurnstile } from "@/hooks/use-turnstile";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import {
	CAPTCHA_RESPONSE_HEADER,
	getAuthErrorMessage,
} from "@/lib/auth/constants";
import { signUpSchema } from "@/schemas/auth-schemas";

export function SignUpCard({ prefillEmail }: { prefillEmail?: string }) {
	const searchParams = useSearchParams();
	const [showPassword, setShowPassword] = React.useState(false);

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
					e && typeof e === "object" && ("code" in e || "message" in e)
						? (e as { code?: string; message?: string })
						: undefined,
				),
			});
		}
	});

	const signInHref = withQuery(
		"/auth/sign-in",
		Object.fromEntries(searchParams.entries()),
	);

	const onGoogleSignIn = () => {
		const callbackURL = new URL(redirectPath, window.location.origin);
		authClient.signIn.social({
			provider: "google",
			callbackURL: callbackURL.toString(),
		});
	};

	return (
		<AuthPageShell
			title={
				<span className="font-light tracking-tighter text-foreground">
					Create your account
				</span>
			}
			description="Start asking questions of your data in minutes"
			footer={
				<p className="text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link
						href={signInHref}
						className="text-violet-600 transition-colors hover:text-violet-700 hover:underline"
					>
						Sign In
					</Link>
				</p>
			}
			socialSection={
				authConfig.enableSignup && authConfig.enableSocialLogin ? (
					<>
						<AuthDivider />
						<AuthGoogleButton onClick={onGoogleSignIn} />
					</>
				) : null
			}
		>
			{methods.formState.isSubmitSuccessful ? (
				<Alert variant="info">
					<AlertDescription>
						We have sent you a link to verify your email. Please check your
						inbox.
					</AlertDescription>
				</Alert>
			) : (
				<>
					{invitationId ? (
						<div className="animate-element animate-delay-250">
							<OrganizationInvitationAlert />
						</div>
					) : null}

					<Form {...methods}>
						<form className="space-y-5" onSubmit={onSubmit}>
							<FormField
								control={methods.control}
								name="name"
								render={({ field }) => (
									<FormItem className="animate-element animate-delay-300 space-y-2">
										<FormLabel className="text-sm font-medium text-muted-foreground">
											Full Name
										</FormLabel>
										<GlassInputWrapper>
											<FormControl>
												<input
													{...field}
													autoComplete="name"
													disabled={methods.formState.isSubmitting}
													maxLength={64}
													placeholder="Enter your full name"
													type="text"
													className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
												/>
											</FormControl>
										</GlassInputWrapper>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={methods.control}
								name="email"
								render={({ field }) => (
									<FormItem className="animate-element animate-delay-400 space-y-2">
										<FormLabel className="text-sm font-medium text-muted-foreground">
											Email Address
										</FormLabel>
										<GlassInputWrapper>
											<FormControl>
												<input
													{...field}
													autoComplete="username"
													disabled={methods.formState.isSubmitting}
													maxLength={255}
													placeholder="Enter your email address"
													type="email"
													className="w-full rounded-2xl bg-transparent p-4 text-sm focus:outline-none"
												/>
											</FormControl>
										</GlassInputWrapper>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={methods.control}
								name="password"
								render={({ field }) => (
									<FormItem className="animate-element animate-delay-500 space-y-2">
										<FormLabel className="text-sm font-medium text-muted-foreground">
											Password
										</FormLabel>
										<GlassInputWrapper>
											<div className="relative">
												<FormControl>
													<input
														{...field}
														autoCapitalize="off"
														autoComplete="new-password"
														disabled={methods.formState.isSubmitting}
														maxLength={72}
														placeholder="Create a password"
														type={showPassword ? "text" : "password"}
														className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm focus:outline-none"
													/>
												</FormControl>
												<AuthPasswordToggle
													showPassword={showPassword}
													onToggle={() =>
														setShowPassword((current) => !current)
													}
												/>
											</div>
										</GlassInputWrapper>
										<PasswordFormMessage password={methods.watch("password")} />
										<FormMessage />
									</FormItem>
								)}
							/>

							{captchaEnabled ? (
								<TurnstileCaptcha
									ref={turnstileRef}
									onSuccess={handleSuccess}
									onError={handleError}
									onExpire={handleExpire}
								/>
							) : null}

							{methods.formState.isSubmitted &&
							methods.formState.errors.root ? (
								<Alert variant="destructive">
									<AlertDescription>
										{methods.formState.errors.root.message}
									</AlertDescription>
								</Alert>
							) : null}

							<button
								type="submit"
								disabled={
									methods.formState.isSubmitting ||
									(captchaEnabled && !captchaToken)
								}
								className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{methods.formState.isSubmitting
									? "Creating account…"
									: "Create Account"}
							</button>
						</form>
					</Form>
				</>
			)}
		</AuthPageShell>
	);
}
