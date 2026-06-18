"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import {
	GitHubIcon,
	LinkedInIcon,
	XIcon,
} from "@/components/marketing/icons/social-icons";
import { appConfig } from "@/config/app.config";

// Build footer links based on config (matching original footer)
const footerLinks = [
	{
		group: "Product",
		items: [
			{ title: "Features", href: "/#features" },
			{ title: "Pricing", href: "/pricing" },
			{ title: "FAQ", href: "/#faq" },
		],
	},
	{
		group: "Resources",
		items: [
			{ title: "Blog", href: "/blog" },
			{ title: "Documentation", href: "/docs" },
			{ title: "Changelog", href: "/changelog" },
		],
	},
	{
		group: "Company",
		items: [
			{ title: "About", href: "/about" },
			{ title: "Careers", href: "/careers" },
			...(appConfig.contact.enabled
				? [{ title: "Contact", href: "/contact" }]
				: []),
		],
	},
	{
		group: "Legal",
		items: [
			{ title: "Privacy Policy", href: "/legal/privacy" },
			{ title: "Terms of Service", href: "/legal/terms" },
			{ title: "Cookie Policy", href: "/legal/cookies" },
		],
	},
];

const socialLinks = [
	{ name: "X", href: "https://twitter.com", icon: XIcon },
	{ name: "GitHub", href: "https://github.com", icon: GitHubIcon },
	{ name: "LinkedIn", href: "https://linkedin.com", icon: LinkedInIcon },
];

function AppInfo() {
	return (
		<div className="flex max-w-sm flex-col gap-2">
			<Logo withLabel={true} className="text-marketing-fg" />
			<div className="flex flex-col gap-4 text-marketing-fg-muted">
				<p>{appConfig.description}</p>
			</div>
		</div>
	);
}

export function Footer() {
	return (
		<footer className="pt-24" id="footer">
			<div className="bg-marketing-card/50 border-t border-marketing-border py-16">
				<div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 lg:px-10">
					{/* Top Section */}
					<div className="grid grid-cols-1 gap-x-12 gap-y-16 text-sm lg:grid-cols-2">
						{/* App Info */}
						<AppInfo />

						{/* Links Grid */}
						<nav className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
							{footerLinks.map((group) => (
								<div key={group.group} className="flex flex-col gap-4">
									<h3 className="font-semibold tracking-wider text-marketing-fg uppercase text-xs">
										{group.group}
									</h3>
									<ul className="flex flex-col gap-3">
										{group.items.map((item) => (
											<li key={item.title}>
												<Link
													href={item.href}
													className="text-marketing-fg-muted hover:text-marketing-fg transition-colors duration-200"
												>
													{item.title}
												</Link>
											</li>
										))}
									</ul>
								</div>
							))}
						</nav>
					</div>

					{/* Bottom Section */}
					<div className="flex flex-col items-center justify-between gap-8 border-t border-marketing-border pt-8 sm:flex-row text-sm">
						<div className="text-marketing-fg-muted order-2 sm:order-1">
							© {new Date().getFullYear()} {appConfig.appName}. All rights
							reserved.
						</div>
						<div className="flex items-center gap-6 order-1 sm:order-2">
							{socialLinks.map((link) => (
								<Link
									key={link.name}
									href={link.href}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={link.name}
									className="text-marketing-fg-muted hover:text-marketing-fg transition-all duration-200 hover:scale-110 active:scale-95 *:size-5"
								>
									<link.icon />
								</Link>
							))}
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
