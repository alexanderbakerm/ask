"use client";

import NiceModal from "@ebay/nice-modal-react";
import { ImageIcon, TrashIcon } from "lucide-react";
import * as React from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuid } from "uuid";
import { CropImageModal } from "@/components/crop-image-modal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UserAvatar } from "@/components/user/user-avatar";
import { storageConfig } from "@/config/storage.config";
import { useSession } from "@/hooks/use-session";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export type UserAvatarUploadProps = {
	onSuccess: () => void;
	onError: () => void;
};

export function UserAvatarUpload({
	onSuccess,
	onError,
}: UserAvatarUploadProps): React.JSX.Element | null {
	const { user, reloadSession } = useSession();
	const [deleting, setDeleting] = React.useState(false);
	const [uploading, setUploading] = React.useState(false);
	const getSignedUploadUrlMutation = trpc.storage.signedUploadUrl.useMutation();

	const handleRemove = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!user) return;

		setDeleting(true);
		try {
			const { error } = await authClient.updateUser({
				image: "",
			});

			if (error) {
				throw error;
			}

			await reloadSession();
			onSuccess();
		} catch (_err) {
			onError();
		} finally {
			setDeleting(false);
		}
	};

	const { getRootProps, getInputProps } = useDropzone({
		onDrop: (acceptedFiles) => {
			NiceModal.show(CropImageModal, {
				image: acceptedFiles[0],
				onCrop: async (croppedImageData: Blob | null) => {
					if (!(croppedImageData && user)) {
						return;
					}

					setUploading(true);
					try {
						const path = `${user.id}-${uuid()}.png`;
						const { signedUrl } = await getSignedUploadUrlMutation.mutateAsync({
							path,
							bucket: storageConfig.bucketNames.images,
						});

						const response = await fetch(signedUrl, {
							method: "PUT",
							body: croppedImageData,
							headers: {
								"Content-Type": "image/png",
							},
						});

						if (!response.ok) {
							throw new Error("Failed to upload image");
						}

						const { error } = await authClient.updateUser({
							image: path,
						});

						if (error) {
							throw error;
						}

						await reloadSession();

						onSuccess();
					} catch (_err) {
						onError();
					} finally {
						setUploading(false);
					}
				},
			});
		},
		accept: {
			"image/png": [".png"],
			"image/jpeg": [".jpg", ".jpeg"],
		},
		multiple: false,
		disabled: uploading || deleting,
	});

	return (
		<>
			<div className="flex flex-row items-center gap-4">
				<div
					className={cn(
						"relative size-20 rounded-full transition-colors shrink-0",
						!user?.image &&
							"cursor-pointer border border-border hover:border-primary",
					)}
					{...getRootProps()}
				>
					<input {...getInputProps()} id="avatar-upload-input" />
					{user?.image ? (
						<UserAvatar
							name={user.name}
							src={user.image}
							className="size-full rounded-full object-cover"
						/>
					) : (
						<div className="flex size-full items-center justify-center">
							<ImageIcon className="size-8 shrink-0 text-primary" />
						</div>
					)}
					{(uploading || deleting) && (
						<div className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-card/90">
							<Spinner />
						</div>
					)}
				</div>
				<div className="flex flex-col space-y-1">
					{user?.image ? (
						<div className="flex flex-row items-center gap-2">
							<Button
								size="sm"
								variant="outline"
								type="button"
								onClick={() => {
									const input = document.getElementById("avatar-upload-input");
									input?.click();
								}}
								disabled={uploading || deleting}
							>
								Change
							</Button>
							<Button
								size="sm"
								variant="ghost"
								type="button"
								onClick={handleRemove}
								disabled={uploading || deleting}
							>
								Remove
							</Button>
						</div>
					) : (
						<>
							<span className="text-sm">Upload a Profile Picture</span>
							<span className="text-xs">
								Choose a photo to upload as your profile picture.
							</span>
						</>
					)}
				</div>
			</div>
		</>
	);
}
