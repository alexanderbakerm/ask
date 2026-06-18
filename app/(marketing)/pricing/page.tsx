import type { Metadata } from "next";
import { CtaSection } from "@/components/marketing/sections/cta-section";
import { FaqSection } from "@/components/marketing/sections/faq-section";
import { PricingSection } from "@/components/marketing/sections/pricing-section";
import { appConfig } from "@/config/app.config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
	title: "Pricing",
	description: `Simple, transparent pricing for ${appConfig.appName}. Choose the plan that works best for you.`,
};

const pricingFaq = {
	headline: "Questions & Answers",
	items: [
		{
			question: "Do I need a credit card to start the free trial?",
			answer:
				"No credit card required to start your free trial. You can explore all features for 14 days before deciding on a plan.",
		},
		{
			question: "Can my whole team use the same account?",
			answer:
				"Yes! All plans support multiple team members. The number of seats varies by plan and you can add more members as your team grows.",
		},
		{
			question: "What payment methods do you accept?",
			answer:
				"We accept all major credit cards (Visa, Mastercard and American Express) and can arrange invoicing for annual plans on our Pro tier.",
		},
		{
			question: "Can I change plans later?",
			answer:
				"Absolutely. You can upgrade or downgrade your plan at any time. Changes take effect immediately and we'll prorate your billing accordingly.",
		},
	],
};

const ctaContent = {
	headline: "Have anymore questions?",
	description:
		"Chat with someone on our sales team who can help you find the right plan for your needs.",
	primaryCta: {
		text: "Chat with us",
		href: `mailto:${appConfig.contact.email}`,
	},
	secondaryCta: {
		text: "Book a demo",
		href: "/contact",
	},
};

export default function PricingPage() {
	return (
		<main className="isolate overflow-clip">
			{/* Hero Section */}
			<section className="py-16 pt-32 lg:pt-40" id="pricing">
				<div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 text-center md:max-w-3xl lg:max-w-7xl lg:px-10">
					<h1
						className={cn(
							"text-balance font-display text-5xl leading-12 tracking-tight",
							"text-marketing-fg",
							"sm:text-[5rem] sm:leading-20",
						)}
					>
						Pricing
					</h1>
					<div className="max-w-xl text-lg leading-8 text-marketing-fg-muted">
						<p>
							Simple, transparent pricing that scales with your business. Start
							free and upgrade as you grow.
						</p>
					</div>
				</div>
			</section>

			{/* Pricing Cards */}
			<PricingSection
				headline=""
				showFreePlans={true}
				showEnterprisePlans={false}
				defaultInterval="month"
			/>

			{/* FAQ */}
			<FaqSection content={pricingFaq} />

			{/* CTA */}
			<CtaSection content={ctaContent} />
		</main>
	);
}
