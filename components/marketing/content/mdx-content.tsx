"use client";

import { MDXContent as MDXContentBase } from "@content-collections/mdx/react";
import { mdxComponents } from "@/lib/marketing/blog/mdx-components";

interface MdxContentProps {
	content: string;
	className?: string;
}

/**
 * Base MDX content renderer used by both blog and legal pages
 */
export function MdxContent({ content, className }: MdxContentProps) {
	return (
		<div className={className}>
			<MDXContentBase
				code={content}
				components={{
					a: mdxComponents.a,
				}}
			/>
		</div>
	);
}
