"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type * as React from "react";
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
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { authConfig } from "@/config/auth.config";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { getAuthErrorMessage } from "@/lib/auth/constants";
import { otpSchema } from "@/schemas/auth-schemas";

export function OtpCard(): React.JSX.Element {
	const searchParams = useSearchParams();

	const invitationId = searchParams.get("invitationId");
	const redirectTo = searchParams.get("redirectTo");

	const redirectPath = invitationId
		? `/dashboard/organization-invitation/${invitationId}`
		: (redirectTo ?? authConfig.redirectAfterSignIn);

	const methods = useZodForm({
		schema: otpSchema,
		defaultValues: {
			code: "",
		},
	});

	const onSubmit = methods.handleSubmit(async ({ code }) => {
		try {
			const { error } = await authClient.twoFactor.verifyTotp({
				code,
			});

			if (error) {
				throw error;
			}

			window.location.href = redirectPath;
		} catch (e) {
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
					Verify your account
				</CardTitle>
				<CardDescription>
					Enter the one-time password from your authenticator app to continue.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...methods}>
					<form
						className="flex flex-col items-stretch gap-4"
						onSubmit={onSubmit}
					>
						<FormField
							control={methods.control}
							name="code"
							render={({ field }) => (
								<FormItem asChild>
									<Field>
										<FormLabel>One-time password</FormLabel>
										<FormControl>
											<InputOTP
												maxLength={6}
												{...field}
												autoComplete="one-time-code"
												onChange={(value) => {
													field.onChange(value);
													onSubmit();
												}}
											>
												<InputOTPGroup>
													<InputOTPSlot className="size-10 text-lg" index={0} />
													<InputOTPSlot className="size-10 text-lg" index={1} />
													<InputOTPSlot className="size-10 text-lg" index={2} />
												</InputOTPGroup>
												<InputOTPSeparator className="opacity-40" />
												<InputOTPGroup>
													<InputOTPSlot className="size-10 text-lg" index={3} />
													<InputOTPSlot className="size-10 text-lg" index={4} />
													<InputOTPSlot className="size-10 text-lg" index={5} />
												</InputOTPGroup>
											</InputOTP>
										</FormControl>
										<FormMessage />
									</Field>
								</FormItem>
							)}
						/>
						{methods.formState.errors.root && (
							<Alert variant="destructive">
								<AlertDescription>
									{methods.formState.errors.root.message}
								</AlertDescription>
							</Alert>
						)}
						<Button loading={methods.formState.isSubmitting} type="submit">
							Verify
						</Button>
					</form>
				</Form>
			</CardContent>
			<CardFooter className="flex justify-center gap-1 text-muted-foreground text-sm">
				<Link className="text-foreground underline" href="/auth/sign-in">
					Go to login page
				</Link>
			</CardFooter>
		</Card>
	);
}
