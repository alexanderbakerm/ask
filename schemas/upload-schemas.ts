import { z } from "zod/v4";

// Signed upload URL
export const signedUploadUrlSchema = z.object({
	bucket: z.string().min(1),
	path: z.string().min(1),
});

// Type exports
export type SignedUploadUrlInput = z.infer<typeof signedUploadUrlSchema>;
