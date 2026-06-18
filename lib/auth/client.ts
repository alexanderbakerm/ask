import {
	adminClient,
	inferAdditionalFields,
	organizationClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
	plugins: [
		inferAdditionalFields<typeof auth>(),
		organizationClient(),
		adminClient(),
		twoFactorClient(),
	],
});

export type AuthClientErrorCodes = typeof authClient.$ERROR_CODES & {
	INVALID_INVITATION: string;
	USER_BANNED: string;
};
