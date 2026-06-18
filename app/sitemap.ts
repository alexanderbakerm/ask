import { allPosts } from "content-collections";
import { getAllLegalPages } from "@/lib/marketing/legal/pages";
import { getBaseUrl } from "@/lib/utils";

type SitemapEntry = {
	url: string;
	lastModified: Date | string;
	changeFreq?: string;
	priority?: number;
};

export default async function Sitemap(): Promise<SitemapEntry[]> {
	const baseUrl = getBaseUrl();

	// Static marketing pages
	const staticPages: SitemapEntry[] = [
		{
			url: `${baseUrl}/`,
			lastModified: new Date(),
			priority: 1,
			changeFreq: "weekly",
		},
		{
			url: `${baseUrl}/about`,
			lastModified: new Date(),
			priority: 0.8,
			changeFreq: "monthly",
		},
		{
			url: `${baseUrl}/pricing`,
			lastModified: new Date(),
			priority: 0.9,
			changeFreq: "weekly",
		},
		{
			url: `${baseUrl}/contact`,
			lastModified: new Date(),
			priority: 0.7,
			changeFreq: "monthly",
		},
		{
			url: `${baseUrl}/blog`,
			lastModified: new Date(),
			priority: 0.8,
			changeFreq: "daily",
		},
		{
			url: `${baseUrl}/faq`,
			lastModified: new Date(),
			priority: 0.7,
			changeFreq: "monthly",
		},
		{
			url: `${baseUrl}/careers`,
			lastModified: new Date(),
			priority: 0.6,
			changeFreq: "weekly",
		},
		{
			url: `${baseUrl}/changelog`,
			lastModified: new Date(),
			priority: 0.6,
			changeFreq: "weekly",
		},
		{
			url: `${baseUrl}/story`,
			lastModified: new Date(),
			priority: 0.6,
			changeFreq: "monthly",
		},
	];

	// Blog posts
	const blogPosts: SitemapEntry[] = allPosts.map((post) => ({
		url: `${baseUrl}/blog/${post.path}`,
		lastModified: post.date,
		priority: 0.7,
		changeFreq: "monthly",
	}));

	// Legal pages
	const legalPages = await getAllLegalPages();
	const legalEntries: SitemapEntry[] = legalPages.map((page) => ({
		url: `${baseUrl}/legal/${page.path}`,
		lastModified: new Date(),
		priority: 0.3,
		changeFreq: "yearly",
	}));

	return [...staticPages, ...blogPosts, ...legalEntries];
}
