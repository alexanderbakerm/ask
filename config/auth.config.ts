import { env } from "@/lib/env";
import { getBaseUrl } from "@/lib/utils";

const origins = Array.from(
	new Set(
		[
			getBaseUrl(),
			env.NEXT_PUBLIC_SITE_URL,
			env.NEXT_PUBLIC_VERCEL_URL
				? `https://${env.NEXT_PUBLIC_VERCEL_URL}`
				: undefined,
			env.NEXT_PUBLIC_VERCEL_BRANCH_URL
				? `https://${env.NEXT_PUBLIC_VERCEL_BRANCH_URL}`
				: undefined,
			env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
				? `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
				: undefined,
			env.NEXT_PUBLIC_NODE_ENV === "development"
				? "http://localhost:3000"
				: undefined,
		].filter(Boolean) as string[],
	),
);

export const authConfig = {
	redirectAfterSignIn: "/dashboard",
	redirectAfterLogout: "/",
	sessionCookieMaxAge: 60 * 60 * 24 * 30,
	verificationExpiresIn: 60 * 60 * 24 * 14,
	minimumPasswordLength: 8,
	trustedOrigins: origins,
	// Allow new user registrations
	// When false, only users with invitations can sign up (invitation-only mode)
	enableSignup: true,
	enableSocialLogin: true,
	cors: {
		allowedOrigins: [...origins, /^https:\/\/.*\.vercel\.app$/],
		allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: [
			"Authorization",
			"Content-Type",
			"Accept",
			"Origin",
			"X-Requested-With",
			"Access-Control-Request-Method",
			"Access-Control-Request-Headers",
			"X-CSRF-Token",
			"Accept-Version",
			"Content-Length",
			"Content-MD5",
			"Date",
			"X-Api-Version",
			"cf-connecting-ip",
			"cf-ipcountry",
			"cf-ray",
			"cf-visitor",
			"x-vercel-id",
			"x-vercel-deployment-url",
			"x-vercel-proxied-for",
			"X-Forwarded-For",
			"X-Forwarded-Host",
			"X-Forwarded-Proto",
			"X-Real-IP",
			"Connection",
			"Host",
			"User-Agent",
			"Referer",
		],
		maxAge: 86_400,
	},
} satisfies AuthConfig;

// Type definitions
export type CorsConfig = {
	allowedOrigins: (string | RegExp)[];
	allowedMethods: string[];
	allowedHeaders: string[];
	maxAge: number;
};

export type AuthConfig = {
	redirectAfterSignIn: string;
	redirectAfterLogout: string;
	sessionCookieMaxAge: number;
	verificationExpiresIn: number;
	minimumPasswordLength: number;
	trustedOrigins: string[];
	enableSignup: boolean;
	enableSocialLogin: boolean;
	cors: CorsConfig;
};
