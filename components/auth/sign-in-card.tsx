"use client";

import { LockIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { withQuery } from "ufo";
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
import { useProgressRouter } from "@/hooks/use-progress-router";
import { useSession } from "@/hooks/use-session";
import { useTurnstile } from "@/hooks/use-turnstile";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import {
	CAPTCHA_RESPONSE_HEADER,
	getAuthErrorMessage,
} from "@/lib/auth/constants";
import { type OAuthProvider, oAuthProviders } from "@/lib/auth/oauth-providers";
import { signInSchema } from "@/schemas/auth-schemas";

export function SignInCard(): React.JSX.Element {
	const router = useProgressRouter();
	const searchParams = useSearchParams();
	const { user, loaded: sessionLoaded } = useSession();

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
		schema: signInSchema,
		defaultValues: {
			email: emailParam ?? "",
			password: "",
		},
	});

	const redirectPath = invitationId
		? `/dashboard/organization-invitation/${invitationId}`
		: (redirectTo ?? authConfig.redirectAfterSignIn);

	React.useEffect(() => {
		if (sessionLoaded && user) {
			router.replace(redirectPath);
		}
	}, [user, sessionLoaded, router, redirectPath]);

	const onSubmit = methods.handleSubmit(async (values) => {
		try {
			const { data, error } = await authClient.signIn.email({
				...values,
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

			if ((data as any).twoFactorRedirect) {
				router.replace(
					withQuery("/auth/verify", Object.fromEntries(searchParams.entries())),
				);
				return;
			}

			// Use window.location.href instead of router.replace to force a full page refresh
			// This ensures that all global providers (SessionProvider, TRPCProvider)
			// are re-initialized with the correct server-side session data.
			window.location.href = redirectPath;
		} catch (e) {
			resetCaptcha();

			if (
				e &&
				typeof e === "object" &&
				"code" in e &&
				"message" in e &&
				e.code === "INVALID_ALLOWLIST"
			) {
				methods.setError("root", {
					message: e.message as string,
				});
			} else if (
				e &&
				typeof e === "object" &&
				"code" in e &&
				"message" in e &&
				e.code === "USER_BANNED"
			) {
				// Store the full message with special marker for parsing in the UI
				methods.setError("root", {
					message: `USER_BANNED|${e.message}`,
				});
			} else {
				methods.setError("root", {
					message: getAuthErrorMessage(
						e && typeof e === "object" && "code" in e
							? (e.code as string)
							: undefined,
					),
				});
			}
		}
	});

	return (
		<Card className="w-full border-transparent px-4 py-8 dark:border-border">
			<CardHeader>
				<CardTitle className="text-base lg:text-lg">
					Sign in to your account
				</CardTitle>
				<CardDescription>
					Welcome back! Please sign in to continue.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{invitationId && <OrganizationInvitationAlert className="mb-6" />}
				<Form {...methods}>
					<form className="space-y-4" onSubmit={onSubmit}>
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
													{...field}
													autoCapitalize="off"
													autoComplete="username"
													disabled={methods.formState.isSubmitting}
													maxLength={255}
													type="email"
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
										<div className="flex flex-row items-center justify-between">
											<FormLabel>Password</FormLabel>
											<Link
												className="ml-auto inline-block text-sm underline"
												href="/auth/forgot-password"
											>
												Forgot password?
											</Link>
										</div>
										<FormControl>
											<InputPassword
												{...field}
												autoCapitalize="off"
												autoComplete="current-password"
												disabled={methods.formState.isSubmitting}
												maxLength={72}
												startAdornment={
													<LockIcon className="size-4 shrink-0" />
												}
											/>
										</FormControl>
										<FormMessage />
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
							methods.formState.errors.root?.message && (
								<Alert variant="destructive">
									<AlertDescription>
										{(() => {
											const message = methods.formState.errors.root.message;
											if (message.startsWith("USER_BANNED|")) {
												const baseMessage = getAuthErrorMessage("USER_BANNED");
												const serverMessage = message.replace(
													"USER_BANNED|",
													"",
												);
												const [reason, expiresInfo] =
													serverMessage.split("|expires:");

												return (
													<div className="space-y-2">
														<p>{baseMessage}</p>
														{reason &&
															reason !== "Your account has been suspended" && (
																<p>
																	<span className="font-medium">Reason:</span>{" "}
																	{reason}
																</p>
															)}
														{expiresInfo && (
															<p className="text-sm opacity-90">
																This suspension will be lifted on {expiresInfo}.
															</p>
														)}
													</div>
												);
											}
											return message;
										})()}
									</AlertDescription>
								</Alert>
							)}
						<Button
							className="w-full"
							loading={methods.formState.isSubmitting}
							type="submit"
							disabled={
								methods.formState.isSubmitting ||
								(captchaEnabled && !captchaToken)
							}
						>
							Sign in
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
			</CardContent>
			{authConfig.enableSignup && (
				<CardFooter className="flex justify-center gap-1 text-muted-foreground text-sm">
					<span>Don't have an account?</span>
					<Link
						className="text-foreground underline"
						href={withQuery(
							"/auth/sign-up",
							Object.fromEntries(searchParams.entries()),
						)}
					>
						Sign up
					</Link>
				</CardFooter>
			)}
		</Card>
	);
}
