import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PostContent } from "@/components/marketing/content/post-content";
import { getAllPosts, getPostBySlug } from "@/lib/marketing/blog/posts";
import { cn } from "@/lib/utils";

type Params = {
	path: string[];
};

export async function generateStaticParams(): Promise<Params[]> {
	const posts = await getAllPosts();
	return posts.map((post) => ({
		path: post.path.split("/"),
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}): Promise<Metadata> {
	const { path } = await params;
	const slug = path.join("/");
	const post = await getPostBySlug(slug);

	if (!post) {
		return {
			title: "Post Not Found",
		};
	}

	return {
		title: post.title,
		description: post.excerpt,
		openGraph: {
			title: post.title,
			description: post.excerpt,
			images: post.image ? [post.image] : [],
		},
	};
}

function estimateReadingTime(text: string, wordsPerMinute = 250): string {
	const words = text.trim().split(/\s+/).length;
	const minutes = Math.ceil(words / wordsPerMinute);
	return minutes === 1 ? "1 min read" : `${minutes} min read`;
}

export default async function BlogPostPage({
	params,
}: {
	params: Promise<Params>;
}) {
	const { path } = await params;
	const slug = path.join("/");
	const post = await getPostBySlug(slug);

	if (!post) {
		return redirect("/blog");
	}

	const { title, excerpt, date, authorName, authorImage, tags, body, rawBody } =
		post;

	return (
		<main className="isolate overflow-clip">
			{/* Header Section */}
			<section className="py-16 pt-32 lg:pt-40">
				<div className="mx-auto flex max-w-2xl flex-col gap-10 px-6 md:max-w-3xl lg:px-10">
					{/* Back link */}
					<Link
						href="/blog"
						className={cn(
							"inline-flex items-center gap-2 text-sm font-medium",
							"text-marketing-fg-muted hover:text-marketing-fg",
							"",
						)}
					>
						<ChevronLeftIcon className="size-3" />
						All posts
					</Link>

					{/* Post meta */}
					<div className="flex flex-col gap-6">
						<div className="flex items-center gap-4 text-sm">
							<span className="inline-flex rounded-full bg-marketing-card-hover px-2 py-0.5 text-xs font-medium capitalize text-marketing-fg-hover">
								{tags?.[0] ?? "Article"}
							</span>
							<time dateTime={date} className="text-marketing-fg-subtle">
								{new Intl.DateTimeFormat("en-US", {
									day: "2-digit",
									month: "short",
									year: "numeric",
								}).format(new Date(date))}
							</time>
							{rawBody && (
								<span className="text-marketing-fg-subtle">
									{estimateReadingTime(rawBody)}
								</span>
							)}
						</div>

						{/* Title */}
						<h1
							className={cn(
								"text-pretty font-display text-[2rem] leading-10 tracking-tight",
								"text-marketing-fg",
								"sm:text-5xl sm:leading-14",
							)}
						>
							{title}
						</h1>

						{/* Excerpt */}
						{excerpt && (
							<p className="text-lg leading-8 text-marketing-fg-muted">
								{excerpt}
							</p>
						)}

						{/* Author */}
						<div className="flex items-center gap-3 text-sm">
							{authorImage && (
								<div className="flex size-10 overflow-hidden rounded-full outline -outline-offset-1 outline-black/5 dark:outline-white/5">
									<img
										src={authorImage}
										alt={authorName ?? ""}
										width={40}
										height={40}
										className="size-full object-cover bg-white/75 dark:bg-black/75"
									/>
								</div>
							)}
							<div>
								<p className="font-semibold text-marketing-fg">{authorName}</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Divider */}
			<div className="mx-auto max-w-2xl px-6 md:max-w-3xl lg:px-10">
				<div className="border-t border-marketing-border" />
			</div>

			{/* Content Section */}
			<section className="py-16">
				<div className="mx-auto max-w-2xl px-6 md:max-w-3xl lg:px-10">
					<article className="prose dark:prose-invert max-w-none prose-headings:font-display prose-headings:tracking-tight prose-p:text-marketing-fg-muted prose-a:text-marketing-fg prose-strong:text-marketing-fg">
						<PostContent content={body} />
					</article>
				</div>
			</section>
		</main>
	);
}
