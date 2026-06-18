import { env } from "@/lib/env";

export const storageConfig = {
	bucketNames: {
		images: env.NEXT_PUBLIC_IMAGES_BUCKET_NAME ?? "",
	},
} satisfies StorageConfig;

// Type definitions
export type StorageConfig = {
	bucketNames: {
		images: string;
	};
};
