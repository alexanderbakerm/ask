"use client";

import { ArrowRightIcon } from "lucide-react";
import * as React from "react";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UserAvatarUpload } from "@/components/user/user-avatar-upload";
import { useSession } from "@/hooks/use-session";
import { useZodForm } from "@/hooks/use-zod-form";
import { authClient } from "@/lib/auth/client";

const formSchema = z.object({
	name: z.string(),
});

export type OnboardingProfileStepProps = {
	onCompleted: () => void;
};

export function OnboardingProfileStep({
	onCompleted,
}: OnboardingProfileStepProps): React.JSX.Element {
	const { user } = useSession();
	const methods = useZodForm({
		schema: formSchema,
		defaultValues: {
			name: user?.name ?? "",
		},
	});

	React.useEffect(() => {
		if (user) {
			methods.setValue("name", user.name ?? "");
		}
	}, [user]);

	const onSubmit = methods.handleSubmit(async ({ name }) => {
		methods.clearErrors("root");

		try {
			await authClient.updateUser({
				name,
			});

			onCompleted();
		} catch (_err) {
			methods.setError("root", {
				type: "server",
				message:
					"We are sorry, but we were unable to set up your account. Please try again later.",
			});
		}
	});

	return (
		<div>
			<Form {...methods}>
				<form className="flex flex-col items-stretch gap-8" onSubmit={onSubmit}>
					<FormField
						control={methods.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Name</FormLabel>
								<FormControl>
									<Input {...field} />
								</FormControl>
							</FormItem>
						)}
					/>
					<FormItem className="flex flex-col gap-4">
						<FormLabel>Avatar</FormLabel>
						<FormControl>
							<UserAvatarUpload
								onError={() => {
									return;
								}}
								onSuccess={() => {
									return;
								}}
							/>
						</FormControl>
					</FormItem>
					<Button loading={methods.formState.isSubmitting} type="submit">
						Continue
						<ArrowRightIcon className="ml-2 size-4 shrink-0" />
					</Button>
				</form>
			</Form>
		</div>
	);
}
