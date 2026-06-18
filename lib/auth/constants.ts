import type { AuthClientErrorCodes } from "@/lib/auth/client";
import type { OrganizationMemberRole } from "@/types/organization-member-role";

/**
 * Header name for passing captcha token to Better Auth endpoints.
 * Used by the captcha plugin to validate requests.
 */
export const CAPTCHA_RESPONSE_HEADER = "x-captcha-response";

/**
 * Human-readable labels for organization member roles.
 */
export const organizationMemberRoleLabels = {
	member: "Member",
	owner: "Owner",
	admin: "Admin",
} as const satisfies Record<OrganizationMemberRole, string>;

/**
 * Human-readable error messages for auth error codes.
 */
export const authErrorMessages: { [K in keyof AuthClientErrorCodes]?: string } =
	{
		INVALID_EMAIL_OR_PASSWORD: "Email or password is not correct.",
		USER_NOT_FOUND: "This user does not exists",
		FAILED_TO_CREATE_USER: "Could not create user. Please try again.",
		FAILED_TO_CREATE_SESSION: "Could not create a session. Please try again.",
		FAILED_TO_UPDATE_USER: "Could not update user. Please try again.",
		FAILED_TO_GET_SESSION: "Could not get the session.",
		INVALID_PASSWORD: "The entered password is incorrect.",
		INVALID_EMAIL: "Email or password is not correct.",
		INVALID_TOKEN: "The token you entered is invalid or has expired.",
		CREDENTIAL_ACCOUNT_NOT_FOUND: "Account not found.",
		EMAIL_CAN_NOT_BE_UPDATED: "Email could not be updated. Please try again.",
		EMAIL_NOT_VERIFIED:
			"We've sent you a verification link. Please check your inbox emails and verify it.",
		FAILED_TO_GET_USER_INFO: "Could not load user information.",
		ID_TOKEN_NOT_SUPPORTED: "ID token is not supported.",
		PASSWORD_TOO_LONG: "Password is too long.",
		PASSWORD_TOO_SHORT: "Password is too short.",
		PROVIDER_NOT_FOUND: "This provider is not suppported.",
		SOCIAL_ACCOUNT_ALREADY_LINKED: "This account is already linked to a user.",
		USER_EMAIL_NOT_FOUND: "Email not found.",
		USER_ALREADY_EXISTS: "Email address is already taken.",
		INVALID_INVITATION: "The invitation is invalid or expired.",
		SESSION_EXPIRED: "The session has expired.",
		FAILED_TO_UNLINK_LAST_ACCOUNT: "Failed to unlink account",
		ACCOUNT_NOT_FOUND: "Account not found",
		USER_BANNED:
			"Your account has been suspended. Please contact support for assistance.",
	};

/**
 * Get a human-readable error message for an auth error code.
 */
export function getAuthErrorMessage(errorCode: string | undefined): string {
	return (
		authErrorMessages[errorCode as keyof typeof authErrorMessages] ||
		"Something went wrong. Please try again."
	);
}
