import { allPosts } from "content-collections";
import type { Post } from "./types";

export async function getAllPosts(): Promise<Post[]> {
	return Promise.resolve(allPosts);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
	return Promise.resolve(allPosts.find((post) => post.path === slug) ?? null);
}
