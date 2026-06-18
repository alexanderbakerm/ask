import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ContactSection } from "@/components/marketing/sections/contact-section";
import { FaqSection } from "@/components/marketing/sections/faq-section";
import { appConfig } from "@/config/app.config";

export const metadata: Metadata = {
	title: "Contact",
	description: "Get in touch with us. We'd love to hear from you.",
};

const contactFaq = {
	headline: "Questions & Answers",
	items: [
		{
			question: "How quickly will I get a response?",
			answer:
				"We typically respond within 24 hours on business days. For urgent matters, please indicate so in your message.",
		},
		{
			question: "Do you offer enterprise plans?",
			answer:
				"Yes! We offer custom enterprise plans with dedicated support, custom integrations and volume pricing. Get in touch to discuss your needs.",
		},
		{
			question: "Can I schedule a demo?",
			answer:
				"Absolutely. Send us a message requesting a demo and we'll set up a time that works for you.",
		},
		{
			question: "What's the best way to get technical support?",
			answer:
				"For existing customers, the fastest way is through our in-app support chat. For general inquiries, this contact form works great.",
		},
	],
};

export default function ContactPage() {
	// Redirect to home if contact page is disabled
	if (!appConfig.contact.enabled) {
		redirect("/");
	}

	return (
		<>
			<ContactSection />
			<FaqSection content={contactFaq} />
		</>
	);
}
