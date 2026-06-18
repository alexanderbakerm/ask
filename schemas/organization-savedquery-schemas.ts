import { z } from "zod/v4";

const vizIntent = z.enum([
	"trend",
	"comparison",
	"partToWhole",
	"correlation",
	"distribution",
	"detail",
]);

// A saved query stores SQL + a lightweight viz SHAPE (no result rows) + the
// intent. On open it re-executes through the chokepoint for fresh data.
export const saveQuerySchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(200),
	dataSourceId: z.string().uuid(),
	question: z.string().trim().max(2000).optional(),
	sql: z.string().trim().min(1, "SQL is required").max(20000),
	intent: vizIntent.optional(),
	vizType: z.string().trim().max(40).optional(),
	columns: z
		.array(
			z.object({
				key: z.string().max(200),
				label: z.string().max(200),
				dataType: z.string().max(40),
			}),
		)
		.max(200)
		.optional(),
});

export const savedQueryIdSchema = z.object({ id: z.string().uuid() });

export const renameSavedQuerySchema = z.object({
	id: z.string().uuid(),
	name: z.string().trim().min(1, "Name is required").max(200),
});

export type SaveQueryInput = z.infer<typeof saveQuerySchema>;
