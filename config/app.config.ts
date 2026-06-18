import { getBaseUrl } from "@/lib/utils";

export const appConfig = {
	appName: "Acme",
	description: `Acme's description`,
	baseUrl: getBaseUrl(),
	// Contact information (displayed on contact page)
	contact: {
		enabled: true,
		email: "hello@yourdomain.com",
		phone: "(123) 456-7890",
		address: "123 Main St, San Francisco, CA",
	},
	// Site sections - enable/disable major parts of the site
	site: {
		// Marketing website (landing page, blog, docs, etc.)
		// When disabled, all marketing routes redirect to /dashboard
		marketing: {
			enabled: true,
		},
		// SaaS application (dashboard, auth, etc.)
		// When disabled, all /dashboard and /auth routes redirect to marketing homepage
		saas: {
			enabled: true,
		},
	},
	// Theme configuration
	theme: {
		// Default theme for new users: "light", "dark", or "system"
		default: "system" as const,
		// Available themes users can choose from
		available: ["light", "dark"] as const,
	},
	// Organization settings
	organizations: {
		// Allow regular users to create organizations
		// When false, only admins can create organizations
		allowUserCreation: true,
	},
	// Pagination defaults
	pagination: {
		// Default page size for lists
		defaultLimit: 25,
		// Maximum allowed page size
		maxLimit: 100,
	},
} satisfies AppConfig;

// Type definitions
export type ContactConfig = {
	enabled: boolean;
	email: string;
	phone: string;
	address: string;
};

export type SiteConfig = {
	marketing: {
		enabled: boolean;
	};
	saas: {
		enabled: boolean;
	};
};

export type ThemeConfig = {
	default: "light" | "dark" | "system";
	available: readonly ("light" | "dark")[];
};

export type OrganizationsConfig = {
	allowUserCreation: boolean;
};

export type PaginationConfig = {
	defaultLimit: number;
	maxLimit: number;
};

export type AppConfig = {
	appName: string;
	description: string;
	baseUrl: string;
	contact: ContactConfig;
	site: SiteConfig;
	theme: ThemeConfig;
	organizations: OrganizationsConfig;
	pagination: PaginationConfig;
};
