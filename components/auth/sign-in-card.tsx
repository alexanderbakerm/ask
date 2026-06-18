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
import { useProgressRouter } from "@/hooks/use-progress-router";
import { useSession } from "@/hooks/use-session";
import { useTurnstile } from "@/hooks/use-turnstile";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import {
	CAPTCHA_RESPONSE_HEADER,
	getAuthErrorMessage,
} from "@/lib/auth/constants";
import { signInSchema } from "@/schemas/auth-schemas";

export function SignInCard(): React.JSX.Element {
	const router = useProgressRouter();
	const searchParams = useSearchParams();
	const { user, loaded: sessionLoaded } = useSession();
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

			if ((data as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
				router.replace(
					withQuery("/auth/verify", Object.fromEntries(searchParams.entries())),
				);
				return;
			}

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

	const signUpHref = withQuery(
		"/auth/sign-up",
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
					Welcome back
				</span>
			}
			description="Access your account and continue your journey with us"
			footer={
				authConfig.enableSignup ? (
					<p className="text-center text-sm text-muted-foreground">
						New to our platform?{" "}
						<Link
							href={signUpHref}
							className="text-violet-400 transition-colors hover:underline"
						>
							Create Account
						</Link>
					</p>
				) : null
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
			{invitationId ? (
				<div className="animate-element animate-delay-250">
					<OrganizationInvitationAlert />
				</div>
			) : null}

			<Form {...methods}>
				<form className="space-y-5" onSubmit={onSubmit}>
					<FormField
						control={methods.control}
						name="email"
						render={({ field }) => (
							<FormItem className="animate-element animate-delay-300 space-y-2">
								<FormLabel className="text-sm font-medium text-muted-foreground">
									Email Address
								</FormLabel>
								<GlassInputWrapper>
									<FormControl>
										<input
											{...field}
											autoCapitalize="off"
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
							<FormItem className="animate-element animate-delay-400 space-y-2">
								<FormLabel className="text-sm font-medium text-muted-foreground">
									Password
								</FormLabel>
								<GlassInputWrapper>
									<div className="relative">
										<FormControl>
											<input
												{...field}
												autoCapitalize="off"
												autoComplete="current-password"
												disabled={methods.formState.isSubmitting}
												maxLength={72}
												placeholder="Enter your password"
												type={showPassword ? "text" : "password"}
												className="w-full rounded-2xl bg-transparent p-4 pr-12 text-sm focus:outline-none"
											/>
										</FormControl>
										<AuthPasswordToggle
											showPassword={showPassword}
											onToggle={() => setShowPassword((current) => !current)}
										/>
									</div>
								</GlassInputWrapper>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
						<label className="flex cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								name="rememberMe"
								className="auth-checkbox"
							/>
							<span className="text-foreground/90">Keep me signed in</span>
						</label>
						<Link
							href="/auth/forgot-password"
							className="text-violet-400 transition-colors hover:underline"
						>
							Reset password
						</Link>
					</div>

					{captchaEnabled ? (
						<TurnstileCaptcha
							ref={turnstileRef}
							onSuccess={handleSuccess}
							onError={handleError}
							onExpire={handleExpire}
						/>
					) : null}

					{methods.formState.isSubmitted &&
					methods.formState.errors.root?.message ? (
						<Alert variant="destructive">
							<AlertDescription>
								{(() => {
									const message = methods.formState.errors.root.message;
									if (message.startsWith("USER_BANNED|")) {
										const baseMessage = getAuthErrorMessage("USER_BANNED");
										const serverMessage = message.replace("USER_BANNED|", "");
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
												{expiresInfo ? (
													<p className="text-sm opacity-90">
														This suspension will be lifted on {expiresInfo}.
													</p>
												) : null}
											</div>
										);
									}
									return message;
								})()}
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
						{methods.formState.isSubmitting ? "Signing in…" : "Sign In"}
					</button>
				</form>
			</Form>
		</AuthPageShell>
	);
}
