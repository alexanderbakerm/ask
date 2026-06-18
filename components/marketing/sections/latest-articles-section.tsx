import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { Post } from "@/lib/marketing/blog/types";
import { cn } from "@/lib/utils";

type LatestArticlesSectionProps = {
	posts: Post[];
};

export function LatestArticlesSection({ posts }: LatestArticlesSectionProps) {
	const latestPosts = posts
		.filter((post) => post.published)
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 3);

	return (
		<section className="py-24 scroll-mt-14" id="blog">
			<div className="mx-auto max-w-2xl px-6 md:max-w-3xl lg:max-w-7xl lg:px-10">
				{/* Header */}
				<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
					<div className="flex flex-col gap-2">
						<h2
							className={cn(
								"text-pretty font-display text-[2rem] leading-10 tracking-tight",
								"text-marketing-fg",
								"sm:text-5xl sm:leading-14",
							)}
						>
							Latest articles
						</h2>
						<p className="text-marketing-fg-muted">
							Insights, updates and stories from our team.
						</p>
					</div>
					<Link
						href="/blog"
						className={cn(
							"group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-marketing-fg hover:underline",
						)}
					>
						View all posts
						<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
					</Link>
				</div>

				{/* Posts Grid */}
				<div className="mt-12 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{latestPosts.map((post) => (
						<Link
							key={post.path}
							href={`/blog/${post.path}`}
							className="group flex flex-col gap-4 rounded-xl bg-marketing-card p-6 transition-colors hover:bg-marketing-card-hover"
						>
							{post.image && (
								<div className="overflow-hidden rounded-sm outline -outline-offset-1 outline-black/5 dark:outline-white/5">
									<img
										src={post.image}
										alt={post.title}
										width={600}
										height={400}
										className="aspect-3/2 w-full object-cover bg-white/75 dark:bg-black/75"
									/>
								</div>
							)}
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between text-sm">
									<span className="inline-flex rounded-full bg-marketing-card-hover px-2 py-0.5 text-xs font-medium capitalize text-marketing-fg-hover">
										{post.tags?.[0] ?? "Article"}
									</span>
									<time
										dateTime={post.date}
										className="text-marketing-fg-subtle"
									>
										{new Intl.DateTimeFormat("en-US", {
											day: "2-digit",
											month: "short",
											year: "numeric",
										}).format(new Date(post.date))}
									</time>
								</div>
								<h3 className="font-semibold text-marketing-fg">
									{post.title}
								</h3>
								<p className="line-clamp-2 text-sm text-marketing-fg-muted">
									{post.excerpt}
								</p>
							</div>
							<div className="mt-auto flex items-center gap-3 pt-2 text-sm">
								{post.authorImage && (
									<div className="flex size-8 overflow-hidden rounded-full outline -outline-offset-1 outline-black/5 dark:outline-white/5">
										<img
											src={post.authorImage}
											alt={post.authorName ?? ""}
											width={32}
											height={32}
											className="size-full object-cover bg-white/75 dark:bg-black/75"
										/>
									</div>
								)}
								<span className="text-marketing-fg-muted">
									{post.authorName}
								</span>
							</div>
						</Link>
					))}
				</div>
			</div>
		</section>
	);
}
