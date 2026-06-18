import type { Metadata } from "next";
import { AboutSection } from "@/components/marketing/sections/about-section";
import { appConfig } from "@/config/app.config";

export const metadata: Metadata = {
	title: "About",
	description: `Learn more about ${appConfig.appName} and our mission to help businesses succeed.`,
};

export default function AboutPage() {
	return <AboutSection />;
}
