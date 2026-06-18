"use client";

import Link from "next/link";
import type { Post } from "@/lib/marketing/blog/types";
import { cn } from "@/lib/utils";

type BlogSectionProps = {
	posts: Post[];
};

export function BlogSection({ posts }: BlogSectionProps) {
	const sortedPosts = posts
		.filter((post) => post.published)
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	return (
		<main className="isolate overflow-clip">
			{/* Hero Section */}
			<section className="py-16 pt-32 lg:pt-40" id="blog-hero">
				<div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 md:max-w-3xl lg:max-w-7xl lg:px-10">
					<h1
						className={cn(
							"text-balance font-display text-5xl leading-12 tracking-tight",
							"text-marketing-fg",
							"sm:text-[5rem] sm:leading-20",
						)}
					>
						Blog
					</h1>
					<div className="max-w-3xl text-lg leading-8 text-marketing-fg-muted">
						<p>Insights, updates and stories from our team.</p>
					</div>
				</div>
			</section>

			{/* Blog Posts Grid */}
			<section className="py-16" id="posts">
				<div className="mx-auto max-w-2xl px-6 md:max-w-3xl lg:max-w-7xl lg:px-10">
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{sortedPosts.map((post) => (
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
									<h2 className="font-semibold text-marketing-fg">
										{post.title}
									</h2>
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
		</main>
	);
}
