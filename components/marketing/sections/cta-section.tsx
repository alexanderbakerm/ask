import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CtaContent {
	headline: string;
	description: string;
	primaryCta: {
		text: string;
		href: string;
	};
	secondaryCta: {
		text: string;
		href: string;
	};
}

interface CtaSectionProps {
	content: CtaContent;
}

/**
 * The design's signature dark band: slate-900 ink panel with a cyan brand
 * accent and the hot gradient bleeding through, sat on the light page.
 */
export function CtaSection({ content }: CtaSectionProps) {
	const { headline, description, primaryCta, secondaryCta } = content;

	return (
		<section id="cta" className="px-6 py-20 lg:px-10 lg:py-28">
			<div className="relative mx-auto max-w-[1080px] overflow-hidden rounded-[28px] bg-[#1a1615] px-8 py-16 text-center sm:px-12 lg:py-20">
				{/* Soft sky glow bleed */}
				<div
					aria-hidden
					className="-right-1/4 -top-1/2 pointer-events-none absolute h-[520px] w-[520px] rounded-[40%] opacity-40 blur-[90px]"
					style={{ background: "radial-gradient(closest-side, #84b9ef, transparent)" }}
				/>
				<div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
					<h2 className="text-balance font-marketing-display font-extrabold text-4xl text-[#fbfaf8] tracking-[-0.02em] sm:text-5xl sm:leading-[1.1]">
						{headline}
					</h2>
					<p className="text-balance text-[#c4bdb9] text-lg leading-8">
						{description}
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3 pt-2">
						<Link
							href={primaryCta.href}
							className={cn(
								"group inline-flex h-11 items-center gap-1.5 rounded-full px-5 font-semibold text-sm",
								"bg-[#fbfaf8] text-[#1a1615] transition-colors hover:bg-[#ece8e4]",
							)}
						>
							{primaryCta.text}
							<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
						</Link>
						<Link
							href={secondaryCta.href}
							className={cn(
								"group inline-flex h-11 items-center gap-1.5 rounded-full px-5 font-semibold text-sm",
								"text-[#fbfaf8] transition-colors hover:text-[#84b9ef]",
							)}
						>
							{secondaryCta.text}
							<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
}
