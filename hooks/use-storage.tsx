"use client";

import { useMemo } from "react";
import { storageConfig } from "@/config/storage.config";

export function useStorage(
	image: string | undefined | null,
	fallback?: string,
): string | undefined {
	return useMemo(() => {
		if (!image) {
			return fallback;
		}
		if (image.startsWith("http")) {
			return image;
		}
		return `/storage/${storageConfig.bucketNames.images}/${image}`;
	}, [image, fallback]);
}
