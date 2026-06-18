import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalContent } from "@/components/marketing/content/legal-content";
import {
	getAllLegalPages,
	getLegalPageBySlug,
} from "@/lib/marketing/legal/pages";
import { cn } from "@/lib/utils";

type PageProps = {
	params: Promise<{
		slug: string;
	}>;
};

export async function generateStaticParams() {
	const pages = await getAllLegalPages();
	return pages.map((page) => ({
		slug: page.path,
	}));
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { slug } = await params;
	const page = await getLegalPageBySlug(slug);

	if (!page) {
		return {
			title: "Page Not Found",
		};
	}

	return {
		title: page.title,
	};
}

export default async function LegalPage({ params }: PageProps) {
	const { slug } = await params;
	const page = await getLegalPageBySlug(slug);

	if (!page) {
		notFound();
	}

	return (
		<main className="isolate overflow-clip">
			{/* Hero Section */}
			<section className="py-16 pt-32 lg:pt-40">
				<div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 md:max-w-3xl lg:px-10">
					<div className="text-sm font-semibold text-marketing-fg-subtle">
						Legal
					</div>
					<h1
						className={cn(
							"text-pretty font-display text-[2rem] leading-10 tracking-tight",
							"text-marketing-fg",
							"sm:text-5xl sm:leading-14",
						)}
					>
						{page.title}
					</h1>
				</div>
			</section>

			{/* Divider */}
			<div className="mx-auto max-w-2xl px-6 md:max-w-3xl lg:px-10">
				<div className="border-t border-marketing-border dark:border-marketing-border" />
			</div>

			{/* Content */}
			<section className="py-16">
				<LegalContent content={page.body} />
			</section>
		</main>
	);
}
