import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { env } from "@/lib/env";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function capitalize(str: string): string {
	if (!str) {
		return str;
	}

	if (str.length === 1) {
		return str.charAt(0).toUpperCase();
	}

	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getInitials(name: string): string {
	if (!name) {
		return "";
	}
	return name
		.trim()
		.replace(/\s+/g, " ")
		.split(" ")
		.slice(0, 2)
		.map((v) => v?.[0]?.toUpperCase())
		.join("");
}

/**
 * Returns the base URL for the app, in order of precedence:
 * 1. Vercel Preview Deployments (uses branch URL)
 * 2. NEXT_PUBLIC_SITE_URL (custom site URL)
 * 3. Vercel Production/Other Deployments (uses Vercel URL)
 * 4. Localhost (fallback)
 */
export function getBaseUrl(): string {
	// 1. Preview deployments on Vercel (branch URL)
	if (
		env.NEXT_PUBLIC_VERCEL_ENV === "preview" &&
		env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF !== "staging" &&
		env.NEXT_PUBLIC_VERCEL_BRANCH_URL
	) {
		return `https://${env.NEXT_PUBLIC_VERCEL_BRANCH_URL}`;
	}

	// 2. Custom site URL (overrides Vercel URL)
	if (env.NEXT_PUBLIC_SITE_URL) {
		return env.NEXT_PUBLIC_SITE_URL;
	}

	// 3. Vercel production/other deployments
	if (env.NEXT_PUBLIC_VERCEL_URL) {
		return `https://${env.NEXT_PUBLIC_VERCEL_URL}`;
	}

	// 4. Local development fallback
	return `http://localhost:3000`;
}

export function downloadCsv(content: string, filename: string) {
	const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.setAttribute("download", filename);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
}

export function downloadExcel(base64Content: string, filename: string) {
	const byteCharacters = atob(base64Content);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	const byteArray = new Uint8Array(byteNumbers);
	const blob = new Blob([byteArray], {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.setAttribute("download", filename);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "Unknown error";
}

export type CsvDelimiterType = "comma" | "semicolon" | "tab";

export function getCsvDelimiterChar(delimiterType: CsvDelimiterType): string {
	switch (delimiterType) {
		case "comma":
			return ",";
		case "semicolon":
			return ";";
		case "tab":
			return "\t";
		default:
			return ",";
	}
}
