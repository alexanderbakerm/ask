import type { Metadata } from "next";
import { ChangelogSection } from "@/components/marketing/sections/changelog-section";
import { appConfig } from "@/config/app.config";

export const metadata: Metadata = {
	title: "Changelog",
	description: `See what's new in ${appConfig.appName}. Latest updates, features and improvements.`,
};

export default function ChangelogPage() {
	return <ChangelogSection />;
}
