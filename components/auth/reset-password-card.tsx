"use client";

import { LockIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type * as React from "react";
import { PasswordFormMessage } from "@/components/auth/password-form-message";
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
import { Field } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { authConfig } from "@/config/auth.config";
import { useSession } from "@/hooks/use-session";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { getAuthErrorMessage } from "@/lib/auth/constants";
import { resetPasswordSchema } from "@/schemas/auth-schemas";

export function ResetPasswordCard(): React.JSX.Element {
	const { user } = useSession();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const methods = useZodForm({
		schema: resetPasswordSchema,
		defaultValues: {
			password: "",
		},
	});

	const onSubmit = methods.handleSubmit(async ({ password }) => {
		try {
			const { error } = await authClient.resetPassword({
				token: token ?? undefined,
				newPassword: password,
			});

			if (error) {
				throw error;
			}

			if (user) {
				window.location.href = authConfig.redirectAfterSignIn;
			}
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
					Reset your password
				</CardTitle>
				<CardDescription>
					Use the form below to change your password.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{methods.formState.isSubmitSuccessful ? (
					<div className="flex flex-col items-center gap-4">
						<Alert variant="info" className="w-full">
							<AlertDescription>
								Your password has been reset successfully.
							</AlertDescription>
						</Alert>
						<Button asChild className="w-full">
							<Link href="/auth/sign-in">Go to login page</Link>
						</Button>
					</div>
				) : (
					<Form {...methods}>
						<form
							className="flex flex-col items-stretch gap-4"
							onSubmit={onSubmit}
						>
							<FormField
								control={methods.control}
								name="password"
								render={({ field }) => (
									<FormItem asChild>
										<Field>
											<FormLabel>New password</FormLabel>
											<FormControl>
												<InputPassword
													autoCapitalize="off"
													autoComplete="new-password"
													disabled={methods.formState.isSubmitting}
													maxLength={72}
													placeholder="Enter your new password"
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
							{methods.formState.errors.root && (
								<Alert variant="destructive">
									<AlertDescription>
										{methods.formState.errors.root.message}
									</AlertDescription>
								</Alert>
							)}
							<Button
								type="submit"
								className="w-full"
								loading={methods.formState.isSubmitting}
								disabled={methods.formState.isSubmitting}
							>
								{methods.formState.isSubmitting
									? "Resetting..."
									: "Reset password"}
							</Button>
						</form>
					</Form>
				)}
			</CardContent>
			{!methods.formState.isSubmitSuccessful && (
				<CardFooter className="flex justify-center gap-1 text-muted-foreground text-sm">
					<span>Remember your password?</span>
					<Link className="text-foreground underline" href="/auth/sign-in">
						Sign in
					</Link>
				</CardFooter>
			)}
		</Card>
	);
}
