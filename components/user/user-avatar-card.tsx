"use client";

import type * as React from "react";
import { toast } from "sonner";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { UserAvatarUpload } from "@/components/user/user-avatar-upload";

export function UserAvatarCard(): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Your Profile Picture</CardTitle>
				<CardDescription>
					Please choose a photo to upload as your profile picture.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<UserAvatarUpload
					onError={() => {
						toast.error("Could not update avatar");
					}}
					onSuccess={() => {
						toast.success("Avatar was updated successfully");
					}}
				/>
			</CardContent>
		</Card>
	);
}
