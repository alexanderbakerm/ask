import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";
import {
	createDocSchema,
	createMetaSchema,
	transformMDX,
} from "@fumadocs/content-collections/configuration";
import rehypeShiki from "@shikijs/rehype";
import { remarkImage } from "fumadocs-core/mdx-plugins";
import { z } from "zod/v4";

function sanitizePath(path: string) {
	return path
		.replace(/(\.[a-zA-Z-]{2,5})$/, "")
		.replace(/^\//, "")
		.replace(/\/$/, "")
		.replace(/index$/, "");
}

// Blog posts collection
const posts = defineCollection({
	name: "posts",
	directory: "content/posts",
	include: "**/*.{mdx,md}",
	schema: z.object({
		title: z.string(),
		date: z.string(),
		image: z.string().optional(),
		authorName: z.string(),
		authorImage: z.string().optional(),
		authorLink: z.string().optional(),
		excerpt: z.string().optional(),
		tags: z.array(z.string()),
		published: z.boolean(),
		content: z.string(),
	}),
	transform: async (document, context) => {
		const body = await compileMDX(context, document, {
			rehypePlugins: [
				[
					rehypeShiki,
					{
						theme: "nord",
					},
				],
			],
		});

		return {
			...document,
			body,
			rawBody: document.content,
			path: sanitizePath(document._meta.path),
		};
	},
});

// Legal pages collection (privacy, terms, etc.)
const legalPages = defineCollection({
	name: "legalPages",
	directory: "content/legal",
	include: "**/*.{mdx,md}",
	schema: z.object({
		title: z.string(),
		content: z.string(),
	}),
	transform: async (document, context) => {
		const body = await compileMDX(context, document);

		return {
			...document,
			body,
			path: sanitizePath(document._meta.path),
		};
	},
});

// Documentation collection (using fumadocs)
const docs = defineCollection({
	name: "docs",
	directory: "content/docs",
	include: "**/*.mdx",
	schema: z.object({
		...createDocSchema(z),
		content: z.string(),
	}),
	transform: async (document, context) =>
		transformMDX(document, context, {
			remarkPlugins: [
				[
					remarkImage,
					{
						publicDir: "public",
					},
				],
			],
		}),
});

// Documentation metadata collection
const docsMeta = defineCollection({
	name: "docsMeta",
	directory: "content/docs",
	include: "**/meta*.json",
	parser: "json",
	schema: z.object(createMetaSchema(z)),
});

export default defineConfig({
	collections: [posts, legalPages, docs, docsMeta],
});
