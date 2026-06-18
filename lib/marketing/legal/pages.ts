import { allLegalPages } from "content-collections";

export async function getAllLegalPages() {
	return allLegalPages;
}

export async function getLegalPageBySlug(slug: string) {
	return allLegalPages.find((page) => page.path === slug);
}
