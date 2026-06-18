import "server-only";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { cache } from "react";
import { createTRPCContext } from "@/trpc/context";
import { createCallerFactory } from "@/trpc/init";
import { createQueryClient } from "@/trpc/query-client";
import { appRouter } from "@/trpc/routers/app";

const getQueryClient = cache(createQueryClient);
const caller = createCallerFactory(appRouter)(createTRPCContext);

export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
	caller,
	getQueryClient,
);
