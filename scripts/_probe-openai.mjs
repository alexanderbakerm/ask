import { openai } from "@ai-sdk/openai";
import { stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

const model = process.argv[2] ?? "gpt-5.5";

async function main() {
	const key = process.env.OPENAI_API_KEY;
	console.log(
		"OPENAI_API_KEY:",
		key ? `present (${key.slice(0, 10)}…, len ${key.length})` : "MISSING",
	);
	console.log("Probing model (tool-calling path):", model);

	const tools = {
		getNumber: tool({
			description: "Returns a fixed number for testing.",
			inputSchema: z.object({ label: z.string() }),
			execute: async ({ label }) => {
				console.log("  → tool getNumber called with label:", label);
				return { value: 42, label };
			},
		}),
	};

	try {
		const result = streamText({
			model: openai(model),
			system:
				"You are a test agent. Use the getNumber tool, then state the value.",
			prompt: "Call getNumber with label 'q4' and tell me the value.",
			tools,
			stopWhen: stepCountIs(4),
		});
		let text = "";
		for await (const delta of result.textStream) {
			text += delta;
		}
		console.log("✓ SUCCESS — final text:", JSON.stringify(text.trim()));
	} catch (err) {
		const e =
			/** @type {{ name?: string; message?: string; statusCode?: unknown; status?: unknown; data?: { error?: { code?: unknown } } }} */ (
				err
			);
		console.log("✗ FAILED");
		console.log("  name:", e?.name);
		console.log("  message:", e?.message);
		const status = e?.statusCode ?? e?.status ?? e?.data?.error?.code;
		if (status) console.log("  status/code:", status);
	}
}

main();
