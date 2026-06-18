import { TRPCError } from "@trpc/server";
import { storageConfig } from "@/config/storage.config";
import { getSignedUploadUrl } from "@/lib/storage";
import { signedUploadUrlSchema } from "@/schemas/upload-schemas";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const storageRouter = createTRPCRouter({
	signedUploadUrl: protectedProcedure
		.input(signedUploadUrlSchema)
		.mutation(async ({ input }) => {
			if (input.bucket === storageConfig.bucketNames.images) {
				const signedUrl = await getSignedUploadUrl(input.path, input.bucket);
				return { signedUrl };
			}

			throw new TRPCError({ code: "FORBIDDEN" });
		}),
});
