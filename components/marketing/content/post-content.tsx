"use client";

import { MdxContent } from "./mdx-content";

export function PostContent({ content }: { content: string }) {
	return (
		<MdxContent
			content={content}
			className="prose dark:prose-invert w-full max-w-none"
		/>
	);
}
