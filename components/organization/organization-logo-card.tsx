"use client";

import NiceModal from "@ebay/nice-modal-react";
import { ImageIcon, TrashIcon } from "lucide-react";
import * as React from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { CropImageModal } from "@/components/crop-image-modal";
import { OrganizationLogo } from "@/components/organization/organization-logo";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { storageConfig } from "@/config/storage.config";
import { useProgressRouter } from "@/hooks/use-progress-router";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export function OrganizationLogoCard(): React.JSX.Element | null {
	const router = useProgressRouter();
	const [deleting, setDeleting] = React.useState(false);
	const [uploading, setUploading] = React.useState(false);
	const { data: organization } = authClient.useActiveOrganization();
	const utils = trpc.useUtils();
	const getSignedUploadUrlMutation = trpc.storage.signedUploadUrl.useMutation();

	const handleRemove = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!organization) return;

		setDeleting(true);
		try {
			const { error } = await authClient.organization.update({
				organizationId: organization.id,
				data: {
					logo: "",
				},
			});

			if (error) {
				throw error;
			}

			toast.success("Logo was removed successfully");
			router.refresh();
			utils.organization.list.invalidate();
		} catch (_err) {
			toast.error("Could not remove logo");
		} finally {
			setDeleting(false);
		}
	};

	const { getRootProps, getInputProps } = useDropzone({
		onDrop: (acceptedFiles) => {
			NiceModal.show(CropImageModal, {
				image: acceptedFiles[0],
				onCrop: async (croppedImageData: Blob | null) => {
					if (!(croppedImageData && organization)) {
						return;
					}

					setUploading(true);
					try {
						const path = `${organization.id}-${uuid()}.png`;
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

						const { error } = await authClient.organization.update({
							organizationId: organization.id,
							data: {
								logo: path,
							},
						});

						if (error) {
							throw error;
						}

						toast.success("Logo was updated successfully");

						router.refresh();
						utils.organization.list.invalidate();
					} catch (_err) {
						toast.error("Could not update logo");
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
		<Card>
			<CardHeader>
				<CardTitle>Organization Logo</CardTitle>
				<CardDescription>
					Update your organization's logo to make it easier to identify.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-row items-center gap-4">
					<div
						className={cn(
							"relative size-20 rounded-md transition-colors shrink-0",
							!organization?.logo &&
								"cursor-pointer border border-border hover:border-primary",
						)}
						{...getRootProps()}
					>
						<input {...getInputProps()} id="logo-upload-input" />
						{organization?.logo ? (
							<OrganizationLogo
								name={organization.name}
								className="size-full rounded-md object-cover"
								src={organization.logo}
							/>
						) : (
							<div className="flex size-full items-center justify-center">
								<ImageIcon className="size-8 shrink-0 text-primary" />
							</div>
						)}
						{(uploading || deleting) && (
							<div className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-card/90">
								<Spinner />
							</div>
						)}
					</div>
					<div className="flex flex-col space-y-1">
						{organization?.logo ? (
							<div className="flex flex-row items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									type="button"
									onClick={() => {
										const input = document.getElementById("logo-upload-input");
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
								<span className="text-sm">Upload a Logo</span>
								<span className="text-xs">
									Choose a photo to upload as your logo.
								</span>
							</>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
