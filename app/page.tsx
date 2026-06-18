"use client";

import "@/components/framer/styles.css";
import type { CSSProperties } from "react";
import AboutAppCarousel from "@/components/framer/about-app-carousel";
import Banner from "@/components/framer/banner";
import BenefitsCard from "@/components/framer/benefits-card";
import BigReview from "@/components/framer/big-review";
import BlogCard from "@/components/framer/blog-card";
import CommunityCard from "@/components/framer/community-card";
import FeaturesPill from "@/components/framer/features-pill";
import Footer from "@/components/framer/footer";
import IntegrationsTicker from "@/components/framer/integrations-ticker";
import MainButton from "@/components/framer/main-button";
import MainCards from "@/components/framer/main-cards";
import NavBar from "@/components/framer/nav-bar";
import ReviewsCard from "@/components/framer/reviews-card";

/**
 * AskBI homepage — composed from the REAL exported Framer components (Dreelio
 * template) so it matches the Framer site's design. Rich sections render from
 * their Framer component (pixel-faithful); the bespoke hero + section headers
 * are reconstructed in the template's tokens (warm cream + Open Runde, from the
 * components' styles.css). Content is AskBI's, passed via component props.
 *
 * Nav / banner / footer carry the template's baked brand text ("Dreelio") until
 * they're edited in Framer + re-exported.
 */

const CREAM = "rgb(249, 248, 248)";
const INK = "rgb(26, 22, 21)";
const MUTED = "rgb(117, 113, 112)";
const BLUE = "rgb(21, 108, 194)";

function SectionHeader({
	eyebrow,
	title,
	subtitle,
}: {
	eyebrow: string;
	title: string;
	subtitle: string;
}) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 16,
				textAlign: "center",
				maxWidth: 720,
				margin: "0 auto",
			}}
		>
			<div
				style={{
					font: "600 13px/1.2 'Open Runde', sans-serif",
					letterSpacing: "0.08em",
					textTransform: "uppercase",
					color: BLUE,
				}}
			>
				{eyebrow}
			</div>
			<h2
				style={{
					font: "600 44px/1.15 'Open Runde', sans-serif",
					letterSpacing: "-0.03em",
					color: INK,
					margin: 0,
				}}
			>
				{title}
			</h2>
			<p
				style={{
					font: "400 18px/1.5 'Open Runde', sans-serif",
					color: MUTED,
					margin: 0,
				}}
			>
				{subtitle}
			</p>
		</div>
	);
}

const sectionStyle: CSSProperties = {
	width: "100%",
	maxWidth: 1072,
	margin: "0 auto",
	padding: "0 24px",
	display: "flex",
	flexDirection: "column",
	gap: 48,
	alignItems: "center",
};

const gridStyle = (cols: number): CSSProperties => ({
	display: "grid",
	gridTemplateColumns: `repeat(${cols}, 1fr)`,
	gap: 20,
	width: "100%",
});

export default function HomePage(): React.JSX.Element {
	return (
		<div style={{ background: CREAM, minHeight: "100vh", overflowX: "clip" }}>
			<NavBar.Responsive />

			<main
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 120,
					paddingBottom: 120,
				}}
			>
				{/* Hero */}
				<section
					style={{
						width: "100%",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 64,
						padding: "160px 24px 0",
					}}
				>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 40,
							maxWidth: 792,
							textAlign: "center",
						}}
					>
						<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
							<h1
								style={{
									font: "600 76px/1.1 'Open Runde', sans-serif",
									letterSpacing: "-0.03em",
									color: INK,
									margin: 0,
								}}
							>
								Ask your data anything.
							</h1>
							<p
								style={{
									font: "400 20px/1.5 'Open Runde', sans-serif",
									color: MUTED,
									margin: "0 auto",
									maxWidth: 620,
								}}
							>
								Ask in plain words and watch your dashboard build itself — in
								seconds. No SQL. No tickets. No waiting on the data team.
							</p>
						</div>
						<div style={{ display: "flex", gap: 12 }}>
							<MainButton.Responsive
								variants={{ base: "Primary" }}
								title="Start free"
								link="/auth/sign-up"
							/>
							<MainButton.Responsive
								variants={{ base: "Secondary" }}
								title="Book a demo"
								link="/contact"
							/>
						</div>
					</div>
					<img
						src="https://framerusercontent.com/images/gUEFVWinvZ7dMZa0mUhNZWHNj3U.png"
						alt="AskBI dashboard"
						style={{
							width: "100%",
							maxWidth: 1040,
							height: "auto",
							borderRadius: 16,
						}}
					/>
				</section>

				{/* Logos ticker */}
				<section style={{ ...sectionStyle, gap: 28 }}>
					<p
						style={{
							font: "500 14px/1.5 'Open Runde', sans-serif",
							color: MUTED,
							margin: 0,
						}}
					>
						Trusted by data teams shipping faster with AskBI
					</p>
					<IntegrationsTicker.Responsive />
				</section>

				{/* About app */}
				<section style={sectionStyle}>
					<SectionHeader
						eyebrow="AI-native BI"
						title="Your data, dashboard-ready"
						subtitle="Connect a database through AskBI's integrations and every metric is ready to explore — ask a question and the visualization is already built."
					/>
					<AboutAppCarousel.Responsive />
				</section>

				{/* Features */}
				<section style={sectionStyle}>
					<SectionHeader
						eyebrow="How it works"
						title="Speaks your language"
						subtitle="Ask in plain English and AskBI handles the SQL, the chart choice, and the layout — grounded in your real schema."
					/>
					<div
						style={{
							display: "flex",
							flexWrap: "wrap",
							gap: 12,
							justifyContent: "center",
						}}
					>
						<FeaturesPill.Responsive title="Database integrations" />
						<FeaturesPill.Responsive title="AI-native visualization" />
						<FeaturesPill.Responsive title="Dashboard-ready data" />
						<FeaturesPill.Responsive title="Read-only by design" />
					</div>
				</section>

				{/* Benefits */}
				<section style={sectionStyle}>
					<SectionHeader
						eyebrow="Why AskBI"
						title="Built for analysts, safe for engineers"
						subtitle="Everything you need to turn a connected warehouse into governed, live dashboards — without writing SQL by hand."
					/>
					<div style={gridStyle(3)}>
						<BenefitsCard.Responsive
							title="Just ask"
							text="Like you'd ask a colleague. No SQL, no formulas."
						/>
						<BenefitsCard.Responsive
							title="Answers in seconds"
							text="The right chart, the moment you ask."
						/>
						<BenefitsCard.Responsive
							title="Everyone in the loop"
							text="Share a dashboard in a tap. One source of truth."
						/>
					</div>
				</section>

				{/* Reviews */}
				<section style={sectionStyle}>
					<BigReview.Responsive
						summary="We connected our warehouse and AskBI had governed dashboards ready the same afternoon. Our analysts just ask, and the chart is already right."
						authorName="Maya Chen"
						authorPosition="Head of Data, Northgrid"
					/>
					<div style={gridStyle(3)}>
						<ReviewsCard.Responsive
							content="Connected our Postgres and had a board in minutes. The SQL it writes is exactly what I'd write."
							name="Diego Ruiz"
							position="Analytics Lead, Voltax"
						/>
						<ReviewsCard.Responsive
							content="Non-technical PMs finally answer their own questions — and I trust it because it's read-only."
							name="Sara Kim"
							position="Eng Manager, Quanta"
						/>
						<ReviewsCard.Responsive
							content="The auto-dashboards picked the right charts straight from our schema. A huge time saver."
							name="Tom Eze"
							position="Founder, Forgeworks"
						/>
					</div>
				</section>

				{/* Pricing */}
				<section style={sectionStyle}>
					<SectionHeader
						eyebrow="Pricing"
						title="Pricing that scales with you"
						subtitle="Start free. Upgrade when your team and your data grow."
					/>
					<MainCards.Responsive />
				</section>

				{/* Blog */}
				<section style={sectionStyle}>
					<SectionHeader
						eyebrow="Blog"
						title="From the AskBI blog"
						subtitle="Tips, tutorials, and guides to get more out of your AskBI workflow."
					/>
					<div style={gridStyle(3)}>
						<BlogCard.Responsive
							title="Meet AskBI: the AI-native BI platform"
							summary="Connect your database, ask in plain English, and get governed dashboards in seconds."
							authorName="AskBI Team"
							authorPosition="Product"
						/>
						<BlogCard.Responsive
							title="Connect your whole stack with AskBI integrations"
							summary="Postgres, Snowflake, BigQuery, or a CSV — connect once and your data is dashboard-ready."
							authorName="AskBI Team"
							authorPosition="Engineering"
						/>
						<BlogCard.Responsive
							title="From database to dashboard, automatically"
							summary="How AskBI turns a connected source into KPIs, trends, and heatmaps — no SQL required."
							authorName="AskBI Team"
							authorPosition="Product"
						/>
					</div>
				</section>

				{/* Community */}
				<section style={sectionStyle}>
					<SectionHeader
						eyebrow="Community"
						title="Join the community"
						subtitle="Stay updated on new features and see how teams use AskBI."
					/>
					<div style={gridStyle(3)}>
						<CommunityCard.Responsive
							appName="Discord"
							summary="Join data teams sharing AskBI tips and dashboards."
							followers="2.4k members"
							linkTitle="Join Discord"
						/>
						<CommunityCard.Responsive
							appName="X"
							summary="Product updates and demos from the AskBI team."
							followers="5.1k followers"
							linkTitle="Follow"
						/>
						<CommunityCard.Responsive
							appName="GitHub"
							summary="Follow the roadmap and open issues."
							followers="1.2k stars"
							linkTitle="Star"
						/>
					</div>
				</section>

				<Banner.Responsive />
			</main>

			<Footer.Responsive />
		</div>
	);
}
