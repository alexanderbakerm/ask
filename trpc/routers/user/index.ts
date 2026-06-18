import {
	getActiveSessions,
	getSession,
	getUserAccounts,
} from "@/lib/auth/server";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/trpc/init";

export const userRouter = createTRPCRouter({
	getSession: publicProcedure.query(async () => await getSession()),
	getActiveSessions: protectedProcedure.query(
		async () => await getActiveSessions(),
	),
	getAccounts: protectedProcedure.query(async () => await getUserAccounts()),
});
