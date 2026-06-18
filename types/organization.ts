import type { auth } from "@/lib/auth";

export type Organization = NonNullable<
	Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;
