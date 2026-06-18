import type { MDXComponents } from "mdx/types";
import Link from "next/link";

function slugifyHeadline(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-")
		.trim();
}

export const mdxComponents = {
	a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
		const { href, children, ...rest } = props;
		const isInternalLink =
			href && (href.startsWith("/") || href.startsWith("#"));

		return isInternalLink ? (
			<Link href={href} {...rest}>
				{children}
			</Link>
		) : (
			<a target="_blank" rel="noopener noreferrer" href={href} {...rest}>
				{children}
			</a>
		);
	},
	img: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
		props.src ? (
			<img
				{...props}
				className="rounded-lg shadow w-full h-auto"
				alt={props.alt || ""}
			/>
		) : null,
	h1: ({ children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h1
			id={slugifyHeadline(children as string)}
			className="mb-6 font-bold text-4xl"
			{...rest}
		>
			{children}
		</h1>
	),
	h2: ({ children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h2
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-2xl"
			{...rest}
		>
			{children}
		</h2>
	),
	h3: ({ children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h3
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-xl"
			{...rest}
		>
			{children}
		</h3>
	),
	h4: ({ children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h4
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-lg"
			{...rest}
		>
			{children}
		</h4>
	),
	h5: ({ children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h5
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-base"
			{...rest}
		>
			{children}
		</h5>
	),
	h6: ({ children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) => (
		<h6
			id={slugifyHeadline(children as string)}
			className="mb-4 font-bold text-sm"
			{...rest}
		>
			{children}
		</h6>
	),
	p: ({ children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) => (
		<p className="mb-6 text-foreground/60 leading-relaxed" {...rest}>
			{children}
		</p>
	),
	ul: ({ children, ...rest }: React.HTMLAttributes<HTMLUListElement>) => (
		<ul className="mb-6 list-inside list-disc space-y-2 pl-4" {...rest}>
			{children}
		</ul>
	),
	ol: ({ children, ...rest }: React.HTMLAttributes<HTMLOListElement>) => (
		<ol className="mb-6 list-inside list-decimal space-y-2 pl-4" {...rest}>
			{children}
		</ol>
	),
	li: ({ children, ...rest }: React.HTMLAttributes<HTMLLIElement>) => (
		<li {...rest}>{children}</li>
	),
} satisfies MDXComponents;
