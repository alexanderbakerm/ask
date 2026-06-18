import type { AuthTestimonial } from "@/components/auth/auth-page-shell";

export const authUiConfig = {
	testimonials: [
		{
			avatarSrc:
				"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop",
			name: "Sarah Chen",
			handle: "@TechStart",
			text: "AskBI turned our spreadsheets into answers our whole team trusts.",
		},
		{
			avatarSrc:
				"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
			name: "Marcus Johnson",
			handle: "@GrowthLabs",
			text: "We went from ad-hoc SQL to dashboards in days, not months.",
		},
		{
			avatarSrc:
				"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop",
			name: "Emily Rodriguez",
			handle: "@InnovateCo",
			text: "The fastest way for ops to get clarity without waiting on analytics.",
		},
	] satisfies AuthTestimonial[],
} as const;
