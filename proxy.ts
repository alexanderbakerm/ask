import { betterFetch } from "@better-fetch/fetch";
import { type NextRequest, NextResponse } from "next/server";
import { withQuery } from "ufo";
import { appConfig } from "./config/app.config";
import { authConfig } from "./config/auth.config";
import type { Session } from "./types/session";

async function getSession(req: NextRequest): Promise<Session | null> {
	try {
		const { data: session, error } = await betterFetch<Session>(
			"/api/auth/get-session?disableCookieCache=true",
			{
				baseURL: req.nextUrl.origin,
				headers: {
					cookie: req.headers.get("cookie") || "",
				},
			},
		);

		if (error) {
			if (process.env.NODE_ENV === "development") {
				console.error("Session fetch failed:", error);
			}
			return null;
		}

		return session;
	} catch (error) {
		if (process.env.NODE_ENV === "development") {
			console.error("Error getting session:", error);
		}
		return null;
	}
}

function getCorsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get("origin") || "*";

	const isAllowed =
		origin === "*" ||
		authConfig.cors.allowedOrigins.some((allowedOrigin) =>
			allowedOrigin instanceof RegExp
				? allowedOrigin.test(origin)
				: allowedOrigin === origin,
		);

	if (isAllowed) {
		const headers: Record<string, string> = {
			"Access-Control-Allow-Methods": authConfig.cors.allowedMethods.join(", "),
			"Access-Control-Allow-Headers": authConfig.cors.allowedHeaders.join(", "),
			"Access-Control-Max-Age": authConfig.cors.maxAge.toString(),
			"Access-Control-Allow-Origin": origin,
		};

		if (origin !== "*") {
			headers["Access-Control-Allow-Credentials"] = "true";
		}

		return headers;
	}

	if (process.env.NODE_ENV === "development") {
		console.warn("CORS origin not allowed", { origin });
	}

	return {};
}

function isProtectedPath(pathname: string): boolean {
	return pathname.startsWith("/dashboard");
}

function canBypassOnboarding(pathname: string): boolean {
	return (
		pathname === "/dashboard/onboarding" ||
		pathname.startsWith("/dashboard/choose-plan") ||
		pathname.startsWith("/dashboard/organization-invitation")
	);
}

export default async function proxy(req: NextRequest) {
	const { pathname, origin, searchParams } = req.nextUrl;

	// CWE-200: Prevent sensitive data exposure in URLs
	// Check auth paths for sensitive parameters and return 400 to prevent logging
	if (pathname.startsWith("/auth")) {
		const hasSensitiveParam = ["password", "apiKey"].some((p) =>
			searchParams.has(p),
		);
		if (hasSensitiveParam) {
			return new NextResponse(
				"Bad Request: Sensitive data should not be passed in URL parameters",
				{ status: 400 },
			);
		}
	}

	// CWE-204: Block TRACE and TRACK methods to prevent proxy/server fingerprinting
	if (req.method === "TRACE" || req.method === "TRACK") {
		return new NextResponse(null, {
			status: 405,
			headers: {
				Allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
				"Content-Type": "text/plain",
			},
		});
	}

	// Handle CORS for API routes
	if (pathname.startsWith("/api") || pathname.startsWith("/storage")) {
		const corsHeaders = getCorsHeaders(req);
		if (req.method === "OPTIONS") {
			return new NextResponse(null, {
				status: 200,
				headers: corsHeaders,
			});
		}
		const response = NextResponse.next();
		for (const [key, value] of Object.entries(corsHeaders)) {
			response.headers.set(key, value);
		}
		return response;
	}

	// If SaaS is disabled, redirect dashboard/auth routes to marketing
	if (!appConfig.site.saas.enabled) {
		if (pathname.startsWith("/dashboard") || pathname.startsWith("/auth")) {
			return NextResponse.redirect(new URL("/", origin));
		}
	}

	// If marketing is disabled, redirect to dashboard
	// Skip API routes and special paths
	if (!appConfig.site.marketing.enabled) {
		const isMarketingPath =
			!pathname.startsWith("/dashboard") &&
			!pathname.startsWith("/auth") &&
			!pathname.startsWith("/api") &&
			!pathname.startsWith("/storage");

		if (isMarketingPath) {
			return NextResponse.redirect(new URL("/dashboard", origin));
		}
	}

	// Protected routes that require authentication
	if (isProtectedPath(pathname)) {
		const session = await getSession(req);

		if (!session) {
			return NextResponse.redirect(
				new URL(
					withQuery("/auth/sign-in", {
						redirectTo: pathname,
					}),
					origin,
				),
			);
		}

		// Check if user is banned (but not if already on banned page)
		if (session.user.banned && pathname !== "/auth/banned") {
			// Check if ban has expired
			const banExpired =
				session.user.banExpires &&
				new Date(session.user.banExpires) < new Date();

			if (!banExpired) {
				// Ban is still active, redirect to banned page
				return NextResponse.redirect(new URL("/auth/banned", origin));
			}
			// If ban has expired, allow the request to continue
			// The ban status will be updated on the next auth check
		}

		// Check onboarding status (with exceptions for certain paths)
		if (!session.user.onboardingComplete && !canBypassOnboarding(pathname)) {
			return NextResponse.redirect(
				new URL(
					withQuery("/dashboard/onboarding", {
						redirectTo: pathname,
					}),
					origin,
				),
			);
		}

		return NextResponse.next();
	}

	// Handle auth routes - redirect logged-in users away
	if (pathname.startsWith("/auth")) {
		const session = await getSession(req);

		// Allow reset-password and banned pages even when logged in
		if (
			session &&
			pathname !== "/auth/banned" &&
			pathname !== "/auth/reset-password"
		) {
			// If user is logged in and has an invitation, redirect to invitation page
			const invitationId = req.nextUrl.searchParams.get("invitationId");
			if (invitationId) {
				return NextResponse.redirect(
					new URL(`/dashboard/organization-invitation/${invitationId}`, origin),
				);
			}
			return NextResponse.redirect(new URL("/dashboard", origin));
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!monitoring|monitoring-tunnel|marketing/avatars|marketing/logos|marketing/placeholders|images|fonts|assets|.well-known|favicon.svg|apple-touch-icon.png|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
	],
};
