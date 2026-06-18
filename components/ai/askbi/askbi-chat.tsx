"use client";

import { useChat } from "@ai-sdk/react";
import NiceModal from "@ebay/nice-modal-react";
import { DefaultChatTransport } from "ai";
import {
	AlertCircleIcon,
	BookmarkIcon,
	DatabaseIcon,
	RefreshCwIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai/conversation";
import { Loader } from "@/components/ai/loader";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@/components/ai/message";
import {
	type ChatStatus,
	PromptInput,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/components/ai/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai/suggestion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/custom/centered-spinner";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AskBiAnswer } from "@/lib/ai/askbi/viz/spec";
import { trpc } from "@/trpc/client";
import { AskBiAnswerView } from "./askbi-answer";
import { SaveQueryModal } from "./save-query-modal";
import { SavedQueriesSheet } from "./saved-queries-sheet";

interface AskBiChatProps {
	organizationId: string;
}

type LoosePart = {
	type?: string;
	text?: string;
	state?: string;
	output?: unknown;
	result?: unknown;
	toolName?: string;
};

function isAskBiAnswer(v: unknown): v is AskBiAnswer {
	return (
		!!v &&
		typeof v === "object" &&
		"primary" in v &&
		typeof (v as { primary?: { type?: unknown } }).primary?.type === "string"
	);
}

function toolLabel(name: string): string {
	if (name === "searchCatalog") return "Searching the catalog…";
	if (name === "runQuery") return "Running the query…";
	if (name === "presentAnswer") return "Building the chart…";
	return "Working…";
}

// Defensive across AI SDK message-part shapes: collect narrative text, the
// presentAnswer vizSpec, and any in-flight tool (for progress).
function parseAssistant(message: { parts?: unknown }): {
	text: string;
	answer?: AskBiAnswer;
	pending?: string;
} {
	const parts: LoosePart[] = Array.isArray(message.parts)
		? (message.parts as LoosePart[])
		: [];
	let text = "";
	let answer: AskBiAnswer | undefined;
	let pending: string | undefined;
	for (const p of parts) {
		if (p.type === "text" && typeof p.text === "string") {
			text += p.text;
			continue;
		}
		const toolName =
			p.toolName ??
			(typeof p.type === "string" && p.type.startsWith("tool-")
				? p.type.slice(5)
				: undefined);
		if (!toolName) continue;
		const output = p.output ?? p.result;
		if (toolName === "presentAnswer" && isAskBiAnswer(output)) {
			answer = output;
			continue;
		}
		const done =
			p.state === "output-available" ||
			p.state === "output-error" ||
			output != null;
		if (!done) pending = toolLabel(toolName);
	}
	return { text, answer, pending };
}

export function AskBiChat({
	organizationId,
}: AskBiChatProps): React.JSX.Element {
	const [input, setInput] = useState("");
	const [dataSourceId, setDataSourceId] = useState<string | null>(null);

	const { data, status: sourcesStatus } =
		trpc.organization.dataSource.list.useQuery();
	const sources = data?.dataSources ?? [];

	// Default to the first connected source (then any source) — always explicit.
	useEffect(() => {
		if (dataSourceId || sources.length === 0) return;
		const connected = sources.find((s) => s.status === "connected");
		setDataSourceId(connected?.id ?? sources[0]?.id ?? null);
	}, [sources, dataSourceId]);

	// Only the stable organizationId goes in the transport body. useChat captures
	// the transport on first render, so a value that changes after mount (like the
	// async-defaulted dataSourceId) would be sent stale — instead it's passed
	// per-request in `ask`, where the closure always has the current value.
	const { messages, sendMessage, status, stop, setMessages } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/ai/askbi",
			body: { organizationId },
		}),
	});

	const isStreaming = status === "streaming" || status === "submitted";
	const chatStatus: ChatStatus = isStreaming ? "streaming" : "ready";
	const canAsk = !!dataSourceId && !isStreaming;

	const ask = (text: string) => {
		if (!text.trim() || !dataSourceId) return;
		sendMessage(
			{ role: "user", parts: [{ type: "text", text: text.trim() }] },
			{ body: { dataSourceId } },
		);
		setInput("");
	};

	if (sourcesStatus === "pending") {
		return <CenteredSpinner />;
	}

	if (sources.length === 0) {
		return (
			<Empty className="flex-1">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<DatabaseIcon />
					</EmptyMedia>
					<EmptyTitle>No data sources connected</EmptyTitle>
					<EmptyDescription>
						AskBI answers questions about your connected databases. Connect one
						to get started.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button asChild>
						<Link href="/dashboard/organization/data-sources">
							Connect a data source
						</Link>
					</Button>
				</EmptyContent>
			</Empty>
		);
	}

	const lastMessage = messages[messages.length - 1];

	return (
		<div className="flex h-full w-full flex-col">
			{/* Source picker — always visible, so the user always knows which DB answers */}
			<div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
				<DatabaseIcon className="size-4 shrink-0 text-muted-foreground" />
				<Select
					value={dataSourceId ?? undefined}
					onValueChange={setDataSourceId}
					disabled={isStreaming}
				>
					<SelectTrigger size="sm" className="w-auto min-w-48">
						<SelectValue placeholder="Select a data source" />
					</SelectTrigger>
					<SelectContent>
						{sources.map((s) => (
							<SelectItem key={s.id} value={s.id}>
								{s.name}
								{s.status !== "connected" ? ` (${s.status})` : ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="ml-auto flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => NiceModal.show(SavedQueriesSheet)}
					>
						<BookmarkIcon className="size-3.5" />
						Saved
					</Button>
					{messages.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setMessages([])}
							disabled={isStreaming}
						>
							<RefreshCwIcon className="size-3.5" />
							New question
						</Button>
					)}
				</div>
			</div>

			<Conversation className="min-h-0 flex-1">
				<ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
					{messages.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
							<h2 className="font-semibold text-2xl">Ask about your data</h2>
							<p className="text-muted-foreground">
								Ask a question in plain English. AskBI writes the SQL, runs it
								read-only, and charts the answer.
							</p>
							<Suggestions className="mt-2 flex-wrap justify-center">
								<Suggestion
									suggestion="Sales of Q4 for product Aurora Laptop"
									onClick={ask}
								/>
								<Suggestion
									suggestion="Revenue by product category"
									onClick={ask}
								/>
								<Suggestion suggestion="Monthly sales trend" onClick={ask} />
							</Suggestions>
						</div>
					) : (
						messages.map((message, idx) => {
							if (message.role === "user") {
								const text = parseAssistant(message).text;
								return (
									<Message key={message.id} from="user">
										<MessageContent className="rounded-2xl bg-secondary px-4 py-3">
											<span className="whitespace-pre-wrap">{text}</span>
										</MessageContent>
									</Message>
								);
							}
							const { text, answer, pending } = parseAssistant(message);
							const priorUser = messages
								.slice(0, idx)
								.reverse()
								.find((m) => m.role === "user");
							const questionText = priorUser
								? parseAssistant(priorUser).text
								: (answer?.primary.title ?? "");
							return (
								<Message key={message.id} from="assistant">
									<div className="flex w-full gap-4">
										<Avatar className="size-8 shrink-0">
											<AvatarFallback className="bg-primary text-primary-foreground">
												<SparklesIcon className="size-4" />
											</AvatarFallback>
										</Avatar>
										<div className="flex min-w-0 flex-1 flex-col gap-3">
											{text && (
												<MessageContent className="max-w-none">
													<MessageResponse>{text}</MessageResponse>
												</MessageContent>
											)}
											{answer && (
												<div className="space-y-2">
													<AskBiAnswerView answer={answer} />
													{dataSourceId && (
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
																NiceModal.show(SaveQueryModal, {
																	dataSourceId,
																	question: questionText,
																	answer,
																})
															}
														>
															<BookmarkIcon className="size-3.5" />
															Save query
														</Button>
													)}
												</div>
											)}
											{isStreaming &&
												pending &&
												message.id === lastMessage?.id && (
													<div className="flex items-center gap-2 text-muted-foreground text-sm">
														<Loader size={16} />
														<span>{pending}</span>
													</div>
												)}
										</div>
									</div>
								</Message>
							);
						})
					)}

					{/* Pre-tool "thinking" while the first step is forming */}
					{isStreaming && lastMessage?.role === "user" && (
						<Message from="assistant">
							<div className="flex w-full gap-4">
								<Avatar className="size-8 shrink-0">
									<AvatarFallback className="bg-primary text-primary-foreground">
										<SparklesIcon className="size-4" />
									</AvatarFallback>
								</Avatar>
								<MessageContent className="max-w-none flex-1">
									<div className="flex items-center gap-2 text-muted-foreground">
										<Loader size={16} />
										<span>Thinking…</span>
									</div>
								</MessageContent>
							</div>
						</Message>
					)}

					{/* Genuine error (network/stream failure) — visually distinct from an
					    honest "couldn't find data", which is just calm assistant text. */}
					{status === "error" && (
						<Message from="assistant" isError>
							<div className="flex w-full gap-4">
								<Avatar className="size-8 shrink-0">
									<AvatarFallback className="bg-destructive text-destructive-foreground">
										<AlertCircleIcon className="size-4" />
									</AvatarFallback>
								</Avatar>
								<MessageContent isError className="max-w-none flex-1">
									<span className="text-destructive">
										Something went wrong running that. Please try again.
									</span>
								</MessageContent>
							</div>
						</Message>
					)}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			<div className="shrink-0 bg-background/80 p-4 backdrop-blur-sm">
				<div className="mx-auto w-full max-w-3xl">
					<PromptInput
						onSubmit={() => ask(input)}
						className="rounded-2xl border shadow-lg"
					>
						<PromptInputTextarea
							value={input}
							onValueChange={setInput}
							disabled={!canAsk}
							placeholder="Ask a question about your data…"
							className="min-h-[52px] rounded-2xl border-0 px-4 py-3"
						/>
						<PromptInputFooter className="px-3 pb-3">
							<PromptInputTools />
							{isStreaming ? (
								<Button
									type="button"
									size="icon"
									variant="outline"
									onClick={() => stop()}
									className="size-8 rounded-xl"
								>
									<span className="sr-only">Stop</span>
									<div className="size-3 rounded-sm bg-current" />
								</Button>
							) : (
								<PromptInputSubmit
									status={chatStatus}
									disabled={!canAsk || !input.trim()}
									className="rounded-xl"
								/>
							)}
						</PromptInputFooter>
					</PromptInput>
					<p className="mt-2 text-center text-muted-foreground text-xs">
						AskBI runs read-only SQL and shows it. Always review the query.
					</p>
				</div>
			</div>
		</div>
	);
}
