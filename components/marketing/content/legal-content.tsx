"use client";

import { MdxContent } from "./mdx-content";

export function LegalContent({ content }: { content: string }) {
	return (
		<div className="mx-auto max-w-2xl px-6 md:max-w-3xl lg:px-10">
			<MdxContent
				content={content}
				className="prose dark:prose-invert max-w-none prose-h1:hidden prose-headings:font-display prose-headings:tracking-tight prose-h2:text-2xl prose-h2:text-marketing-fg prose-h3:text-xl prose-h3:text-marketing-fg prose-p:text-marketing-fg-muted prose-li:text-marketing-fg-muted prose-strong:text-marketing-fg prose-a:text-marketing-fg"
			/>
		</div>
	);
}
