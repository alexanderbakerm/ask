"use client";

import { InfiniteSlider } from "@/components/marketing/primitives/infinite-slider";
import { ProgressiveBlur } from "@/components/marketing/primitives/progressive-blur";

// Fictional placeholder wordmarks (originally drawn for the design kit).
const logos = [
	{ src: "/landing/customer-logos/northgrid.svg", alt: "Northgrid" },
	{ src: "/landing/customer-logos/voltax.svg", alt: "Voltax" },
	{ src: "/landing/customer-logos/halcyon.svg", alt: "Halcyon" },
	{ src: "/landing/customer-logos/moncrest.svg", alt: "Moncrest" },
	{ src: "/landing/customer-logos/quanta.svg", alt: "Quanta" },
	{ src: "/landing/customer-logos/prism.svg", alt: "Prism" },
	{ src: "/landing/customer-logos/atlas-co.svg", alt: "Atlas Co" },
	{ src: "/landing/customer-logos/forgeworks.svg", alt: "Forgeworks" },
];

export function LogoCloudSection() {
	return (
		<section className="overflow-hidden border-marketing-border/70 border-t py-10">
			<p className="mb-7 text-center text-marketing-fg-subtle text-sm">
				Trusted by data teams shipping faster with AskBI
			</p>
			<div className="group relative mx-auto max-w-screen-2xl px-4 sm:px-6 md:px-12">
				<div className="relative w-full">
					<InfiniteSlider speedOnHover={20} speed={40} gap={112}>
						{logos.map((logo) => (
							<div key={logo.alt} className="flex">
								<img
									className="mx-auto h-6 w-fit opacity-60 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
									src={logo.src}
									alt={logo.alt}
									width={120}
									height={24}
								/>
							</div>
						))}
					</InfiniteSlider>

					<ProgressiveBlur
						className="pointer-events-none absolute inset-y-0 left-0 h-full w-20"
						direction="left"
						blurIntensity={1}
					/>
					<ProgressiveBlur
						className="pointer-events-none absolute inset-y-0 right-0 h-full w-20"
						direction="right"
						blurIntensity={1}
					/>
				</div>
			</div>
		</section>
	);
}
