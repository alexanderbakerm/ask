"use client";

import { MailIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";
import { getAuthErrorMessage } from "@/lib/auth/constants";
import { forgotPasswordSchema } from "@/schemas/auth-schemas";

export function ForgotPasswordCard(): React.JSX.Element {
	const methods = useZodForm({
		schema: forgotPasswordSchema,
		mode: "onSubmit",
		defaultValues: {
			email: "",
		},
	});

	const onSubmit = methods.handleSubmit(async ({ email }) => {
		try {
			const redirectTo = new URL(
				"/auth/reset-password",
				window.location.origin,
			).toString();

			const { error } = await authClient.requestPasswordReset({
				email,
				redirectTo,
			});
			if (error) {
				throw error;
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
					Forgot your password?
				</CardTitle>
				<CardDescription>
					No worries! We'll send you a link with instructions on how to reset
					your password.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{methods.formState.isSubmitSuccessful ? (
					<Alert variant="info">
						<AlertTitle>Link sent</AlertTitle>
						<AlertDescription>
							We have sent you a link to continue. Please check your inbox.
						</AlertDescription>
					</Alert>
				) : (
					<Form {...methods}>
						<form className="flex flex-col gap-4" onSubmit={onSubmit}>
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
														placeholder="you@example.com"
													/>
												</InputGroup>
											</FormControl>
											<FormMessage />
										</Field>
									</FormItem>
								)}
							/>
							{methods.formState.errors.root && (
								<Alert variant="destructive">
									<AlertTitle>
										{methods.formState.errors.root.message}
									</AlertTitle>
								</Alert>
							)}
							<Button
								className="w-full"
								loading={methods.formState.isSubmitting}
								type="submit"
								disabled={methods.formState.isSubmitting}
							>
								{methods.formState.isSubmitting
									? "Sending..."
									: "Send instructions"}
							</Button>
						</form>
					</Form>
				)}
			</CardContent>
			<CardFooter className="flex justify-center gap-1 text-muted-foreground text-sm">
				<span>Remembered your password?</span>
				<Link className="text-foreground underline" href="/auth/sign-in">
					Sign in
				</Link>
			</CardFooter>
		</Card>
	);
}
