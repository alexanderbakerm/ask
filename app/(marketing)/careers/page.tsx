import type { Metadata } from "next";
import {
	CareersBenefitsSection,
	CareersPositionsSection,
} from "@/components/marketing/sections/careers-section";
import { appConfig } from "@/config/app.config";

export const metadata: Metadata = {
	title: "Careers",
	description: `Join the ${appConfig.appName} team. Explore open positions and help us build the future of SaaS.`,
};

export default function CareersPage() {
	return (
		<>
			<CareersBenefitsSection />
			<CareersPositionsSection />
		</>
	);
}
