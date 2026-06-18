import { createTRPCRouter } from "@/trpc/init";
import { adminOrganizationRouter } from "@/trpc/routers/admin/admin-organization-router";
import { adminUserRouter } from "@/trpc/routers/admin/admin-user-router";

export const adminRouter = createTRPCRouter({
	organization: adminOrganizationRouter,
	user: adminUserRouter,
});
