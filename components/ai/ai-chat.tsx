"use client";

import { useChat } from "@ai-sdk/react";
import NiceModal from "@ebay/nice-modal-react";
import { TextStreamChatTransport } from "ai";
import {
	AlertCircleIcon,
	CoinsIcon,
	MoreHorizontalIcon,
	PanelLeftCloseIcon,
	PanelLeftIcon,
	PlusIcon,
	RefreshCwIcon,
	SparklesIcon,
} from "lucide-react";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai/conversation";
import { Loader } from "@/components/ai/loader";
import {
	Message,
	MessageContent,
	MessageCopyButton,
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
import { RenameChatModal } from "@/components/ai/rename-chat-modal";
import { Suggestion, Suggestions } from "@/components/ai/suggestion";
import { PurchaseCreditsModal } from "@/components/billing/purchase-credits-modal";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/ui/custom/centered-spinner";
import { InputSearch } from "@/components/ui/custom/input-search";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user/user-avatar";
import {
	type ChatModelId,
	chatModels,
	DEFAULT_CHAT_MODEL,
	getChatModelCostEstimate,
} from "@/config/billing.config";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
	isError?: boolean;
}

interface AiChatProps {
	organizationId: string;
}

// Helper function to extract text content from message parts
function getMessageText(
	message: ReturnType<typeof useChat>["messages"][number],
): string {
	// Try to get content from parts first (for multimodal/edited messages)
	const textPart = message.parts?.find((part) => part.type === "text");
	if (textPart && typeof textPart.text === "string") {
		return textPart.text;
	}

	// Fallback to strict content string
	// Note: message.content might be empty if parts are used, but if parts failed, this is our best bet
	const msg = message as { content?: string };
	if (typeof msg.content === "string") {
		return msg.content;
	}

	return "";
}

export function AiChat({ organizationId }: AiChatProps) {
	const { user } = useSession();
	const utils = trpc.useUtils();
	const [input, setInput] = useState("");
	const [chatId, setChatId] = useQueryState("chatId");
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [selectedModel, setSelectedModel] =
		useState<ChatModelId>(DEFAULT_CHAT_MODEL);
	const [searchQuery, setSearchQuery] = useState("");

	// Guard against concurrent chat creation (prevents race condition on org switch/creation)
	const isCreatingChatRef = useRef(false);

	// Fetch all chats for the organization
	const { data: chatsData, status: chatsStatus } =
		trpc.organization.ai.listChats.useQuery(undefined, {
			enabled: !searchQuery,
		});

	// Search chats when there's a search query
	const { data: searchData, isFetching: isSearching } =
		trpc.organization.ai.searchChats.useQuery(
			{ query: searchQuery },
			{ enabled: !!searchQuery },
		);

	// Fetch current chat
	const {
		data: currentChatData,
		error: currentChatError,
		isLoading: isLoadingChat,
	} = trpc.organization.ai.getChat.useQuery(
		{ id: chatId! },
		{ enabled: !!chatId, retry: false },
	);

	const chats = searchQuery
		? (searchData?.chats ?? [])
		: (chatsData?.chats ?? []);
	const currentChat = currentChatData?.chat ?? null;
	const isSearchMode = !!searchQuery;

	// Create chat mutation
	const createChatMutation = trpc.organization.ai.createChat.useMutation();

	// Update chat mutation (for saving messages)
	const updateChatMutation = trpc.organization.ai.updateChat.useMutation({
		onSuccess: (data) => {
			if (data.chat.id) {
				// Optimistically update the single chat query
				utils.organization.ai.getChat.setData({ id: data.chat.id }, data);
			}
		},
	});

	const getConsolidatedMessages = useCallback(
		(currentLocalMessages: any[]): ChatMessage[] => {
			const local: ChatMessage[] = currentLocalMessages.map((m) => ({
				role: (m.role as "user" | "assistant" | "system") || "user",
				content: getMessageText(m),
				isError: !!(m as any).isError,
			}));
			const dbHistory = (currentChat?.messages as any as ChatMessage[]) || [];

			if (local.length === 0) return dbHistory;
			if (dbHistory.length === 0) return local;

			// Heuristic: if the first local message doesn't match the first DB message,
			// local state is likely missing history (e.g., only contains new session messages).
			const isSynced =
				local[0] &&
				dbHistory[0] &&
				local[0].role === dbHistory[0].role &&
				local[0].content === dbHistory[0].content;

			if (!isSynced) {
				// Prepend DB messages that are not already in local to restore history.
				// We filter to avoid duplication if there's partial overlap.
				const localContents = new Set(
					local.map((l) => `${l.role}:${l.content}`),
				);
				const missingFromLocal = dbHistory.filter(
					(d) => !localContents.has(`${d.role}:${d.content}`),
				);
				return [...missingFromLocal, ...local];
			}

			return local;
		},
		[currentChat?.messages],
	);

	// Delete chat mutation
	const deleteChatMutation = trpc.organization.ai.deleteChat.useMutation();

	// Toggle pin mutation
	const togglePinMutation = trpc.organization.ai.togglePin.useMutation();

	// Use the AI SDK's useChat hook
	const { messages, setMessages, sendMessage, status, stop } = useChat({
		id: chatId ?? "new",
		transport: new TextStreamChatTransport({
			api: "/api/ai/chat",
			body: {
				chatId,
				organizationId,
				model: selectedModel,
			},
		}),
		onFinish: () => {
			if (chatId) {
				// Fire-and-forget cache invalidation - errors don't affect UX
				utils.organization.ai.getChat
					.invalidate({ id: chatId })
					.catch(() => {});
			}
			// Invalidate credit balance so settings tab shows updated credits
			utils.organization.credit.getBalance.invalidate().catch(() => {});
			utils.organization.credit.getTransactions.invalidate().catch(() => {});
		},
		onError: (error) => {
			const errorText = error.message || String(error);
			let userFriendlyMessage = "Failed to send message";
			let isPersistable = true;

			// Try to parse JSON error response from API
			try {
				const parsed: unknown = JSON.parse(errorText);

				if (
					typeof parsed === "object" &&
					parsed !== null &&
					"error" in parsed &&
					typeof parsed.error === "string"
				) {
					const errorCode = parsed.error;
					const errorMessage =
						"message" in parsed && typeof parsed.message === "string"
							? parsed.message
							: undefined;

					switch (errorCode) {
						case "insufficient_credits":
							userFriendlyMessage = "Not enough credits";
							toast.error(userFriendlyMessage, {
								description: "Purchase more credits to continue using AI chat.",
								action: {
									label: "Buy credits",
									onClick: () => NiceModal.show(PurchaseCreditsModal),
								},
							});
							break;
						case "unauthorized":
							userFriendlyMessage = "Session expired";
							isPersistable = false;
							toast.error(userFriendlyMessage, {
								description: "Please sign in again to continue.",
							});
							break;
						case "forbidden":
						case "not_found":
							userFriendlyMessage = "Access denied";
							isPersistable = false;
							toast.error(userFriendlyMessage, {
								description: "You don't have permission to access this chat.",
							});
							break;
						default:
							userFriendlyMessage = errorMessage || "Something went wrong";
							toast.error("Error", { description: userFriendlyMessage });
					}
				} else {
					toast.error(userFriendlyMessage);
				}
			} catch {
				toast.error(userFriendlyMessage);
			}

			// Persist the error message in the chat history
			if (isPersistable && chatId) {
				const errorMsg: ChatMessage = {
					role: "assistant",
					content: userFriendlyMessage,
					isError: true,
				};

				const consolidated = getConsolidatedMessages(messages);
				const newMessages = [...consolidated, errorMsg];

				// Optimistically update local messages
				setMessages([
					...messages,
					{
						id: `err-${Date.now()}`,
						role: "assistant",
						parts: [{ type: "text", text: userFriendlyMessage }],
						isError: true,
					} as any,
				]);

				updateChatMutation.mutate({
					id: chatId,
					messages: newMessages,
				});
			}
		},
	});

	const isStreaming = status === "streaming" || status === "submitted";
	const chatStatus: ChatStatus = isStreaming ? "streaming" : "ready";

	// Sync messages from the current chat
	useEffect(() => {
		if (currentChat?.messages && Array.isArray(currentChat.messages)) {
			const parsedMessages = (currentChat.messages as ChatMessage[]).map(
				(msg, i) => ({
					id: `msg-${i}`,
					role: msg.role as "user" | "assistant",
					parts: [{ type: "text" as const, text: msg.content }],
					isError: msg.isError,
				}),
			);
			setMessages(parsedMessages as any);
		}
	}, [currentChat?.messages, setMessages]);

	// Create a new chat
	const createNewChat = useCallback(async () => {
		// Prevent concurrent chat creation (race condition guard)
		if (isCreatingChatRef.current) {
			return;
		}
		isCreatingChatRef.current = true;

		try {
			const result = await createChatMutation.mutateAsync({});
			await utils.organization.ai.listChats.invalidate();
			if (result.chat.id) {
				setChatId(result.chat.id);
			}
			setMessages([]);
		} catch {
			toast.error("Failed to create chat");
		} finally {
			isCreatingChatRef.current = false;
		}
	}, [
		createChatMutation,
		utils.organization.ai.listChats,
		setChatId,
		setMessages,
	]);

	// Delete a chat (internal)
	const performDeleteChat = useCallback(
		async (id: string) => {
			try {
				// Calculate remaining chats before mutation
				const remainingChats = chats.filter((c) => c.id !== id);
				const isCurrentChat = chatId === id;

				await deleteChatMutation.mutateAsync({ id });

				// Optimistically update the cache
				utils.organization.ai.listChats.setData(undefined, (oldData) => {
					if (!oldData) return oldData;
					return {
						...oldData,
						chats: oldData.chats.filter((c) => c.id !== id),
					};
				});

				// Also invalidate to ensure consistency with server
				// Fire-and-forget - errors don't affect UX since we already updated optimistically
				utils.organization.ai.listChats.invalidate().catch(() => {});

				if (isCurrentChat) {
					// Clear messages immediately
					setMessages([]);

					if (remainingChats.length > 0 && remainingChats[0]?.id) {
						setChatId(remainingChats[0].id);
					} else {
						setChatId(null);
						createNewChat();
					}
				}
				toast.success("Chat deleted");
			} catch {
				toast.error("Failed to delete chat");
			}
		},
		[
			deleteChatMutation,
			utils.organization.ai.listChats,
			chatId,
			chats,
			setChatId,
			setMessages,
			createNewChat,
		],
	);

	// Delete chat with confirmation
	const deleteChat = useCallback(
		(id: string) => {
			NiceModal.show(ConfirmationModal, {
				title: "Delete Chat",
				message:
					"Are you sure you want to delete this chat? This action cannot be undone.",
				confirmLabel: "Delete",
				destructive: true,
				onConfirm: () => performDeleteChat(id),
			});
		},
		[performDeleteChat],
	);

	// Toggle pin status
	const togglePin = useCallback(
		async (id: string) => {
			try {
				await togglePinMutation.mutateAsync({ id });
				await utils.organization.ai.listChats.invalidate();
			} catch {
				toast.error("Failed to update pin status");
			}
		},
		[togglePinMutation, utils.organization.ai.listChats],
	);

	// Auto-select or create chat on load
	useEffect(() => {
		if (chatId || chatsStatus !== "success") {
			return;
		}

		if (chats.length > 0 && chats[0]?.id) {
			setChatId(chats[0].id);
		} else {
			createNewChat();
		}
	}, [chatsStatus, chats, chatId, setChatId, createNewChat]);

	// Handle invalid chat ID (chat not found in database)
	useEffect(() => {
		if (currentChatError && chatId && chatsStatus === "success") {
			// Chat doesn't exist, clear the invalid chatId and select a valid one
			if (chats.length > 0 && chats[0]?.id) {
				setChatId(chats[0].id);
			} else {
				setChatId(null);
			}
		}
	}, [currentChatError, chatId, chats, chatsStatus, setChatId]);

	const hasChat =
		chatsStatus === "success" && chats.length > 0 && !!currentChat?.id;

	const groupedChats = useMemo(() => {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
		const thisWeekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
		const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

		type ChatGroup = {
			label: string;
			chats: typeof chats;
		};

		const groups: ChatGroup[] = [
			{ label: "Pinned", chats: [] },
			{ label: "Today", chats: [] },
			{ label: "Yesterday", chats: [] },
			{ label: "This Week", chats: [] },
			{ label: "This Month", chats: [] },
			{ label: "Older", chats: [] },
		];

		const sortedChats = [...chats].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		for (const chat of sortedChats) {
			// Pinned chats go to their own group
			if (chat.pinned) {
				groups[0]?.chats.push(chat);
				continue;
			}

			const chatDate = new Date(chat.createdAt);
			if (chatDate >= today) {
				groups[1]?.chats.push(chat);
			} else if (chatDate >= yesterday) {
				groups[2]?.chats.push(chat);
			} else if (chatDate >= thisWeekStart) {
				groups[3]?.chats.push(chat);
			} else if (chatDate >= thisMonth) {
				groups[4]?.chats.push(chat);
			} else {
				groups[5]?.chats.push(chat);
			}
		}

		return groups.filter((group) => group.chats.length > 0);
	}, [chats]);

	const handleSendMessage = useCallback(
		async (text: string) => {
			if (!text.trim() || !chatId) return;

			const consolidated = getConsolidatedMessages(messages);
			const updatedMessages = [
				...consolidated,
				{ role: "user" as const, content: text.trim() },
			];

			try {
				await updateChatMutation.mutateAsync({
					id: chatId,
					messages: updatedMessages,
				});

				sendMessage({
					role: "user",
					parts: [{ type: "text", text: text.trim() }],
				});
			} catch {
				toast.error("Failed to send message");
			}
		},
		[chatId, messages, updateChatMutation, sendMessage],
	);

	const onSubmit = async () => {
		const text = input.trim();
		if (!text) return;

		await handleSendMessage(text);
		setInput("");
	};

	// Regenerate the last assistant response
	const handleRegenerate = useCallback(async () => {
		if (!chatId || messages.length < 2) return;

		// Find the last user message in the consolidated history
		const fullHistory = getConsolidatedMessages(messages);
		const lastUserIndex = fullHistory.findLastIndex((m) => m.role === "user");
		if (lastUserIndex === -1 || !fullHistory[lastUserIndex]) return;

		const userMessageText = fullHistory[lastUserIndex].content;

		// Keep messages up to the last user message
		const updatedMessages = fullHistory.slice(0, lastUserIndex + 1);

		try {
			await updateChatMutation.mutateAsync({
				id: chatId,
				messages: updatedMessages,
			});

			// Update UI to match the rolled-back state
			const messagesUpToLastUser = messages.slice(
				0,
				messages.findLastIndex((m) => m.role === "user") + 1,
			);
			setMessages(messagesUpToLastUser);

			// Resend the last user message to get a new response
			sendMessage({
				role: "user",
				parts: [{ type: "text", text: userMessageText }],
			});
		} catch {
			toast.error("Failed to regenerate response");
		}
	}, [chatId, messages, setMessages, updateChatMutation, sendMessage]);

	if (chatsStatus === "pending") {
		return <CenteredSpinner />;
	}

	return (
		<div className="flex h-full w-full overflow-hidden">
			{/* Sidebar */}
			<div
				className={cn(
					"flex h-full shrink-0 flex-col border-r border-border/50 transition-all duration-300",
					sidebarOpen ? "w-64" : "w-0 overflow-hidden border-r-0",
				)}
			>
				{/* Sidebar Header */}
				<div className="shrink-0 space-y-2 p-3">
					<Button
						variant="outline"
						size="sm"
						className="flex w-full items-center justify-center gap-2"
						loading={createChatMutation.isPending}
						onClick={createNewChat}
					>
						<PlusIcon className="size-4" />
						New chat
					</Button>

					{/* Search Input */}
					<InputSearch
						placeholder="Search chats..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-8"
					/>
				</div>

				{/* Chat List */}
				<div className="min-h-0 flex-1 overflow-hidden">
					<ScrollArea className="h-full">
						<div className="space-y-4 px-2 pb-4">
							{isSearching && (
								<div className="flex items-center justify-center py-4">
									<CenteredSpinner />
								</div>
							)}
							{!isSearching && isSearchMode && chats.length === 0 && (
								<div className="px-3 py-4 text-center text-muted-foreground text-sm">
									No chats found for "{searchQuery}"
								</div>
							)}
							{!isSearching && isSearchMode && chats.length > 0 && (
								<div>
									<div className="mb-1 px-3 py-1 text-muted-foreground text-xs font-medium">
										Search Results
									</div>
									<div className="space-y-1">
										{chats.map((chat) => {
											const title =
												chat.title ||
												chat.firstMessageContent?.slice(0, 30) ||
												"New chat";
											return (
												<div
													key={chat.id}
													className={cn(
														"group relative flex items-center rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
														chat.id === chatId && "bg-accent",
													)}
												>
													<button
														type="button"
														onClick={() => {
															setChatId(chat.id);
															setSearchQuery("");
														}}
														className="flex min-w-0 flex-1 cursor-pointer"
													>
														<span className="block truncate text-left">
															{title}
														</span>
													</button>
												</div>
											);
										})}
									</div>
								</div>
							)}
							{!isSearchMode &&
								groupedChats.map((group) => (
									<div key={group.label}>
										<div className="mb-1 px-3 py-1 text-muted-foreground text-xs font-medium">
											{group.label}
										</div>
										<div className="space-y-1">
											{group.chats.map((chat) => {
												const title =
													chat.title ||
													chat.firstMessageContent?.slice(0, 30) ||
													"New chat";
												return (
													<div
														key={chat.id}
														className={cn(
															"group relative flex items-center rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
															chat.id === chatId && "bg-accent",
														)}
													>
														<button
															type="button"
															onClick={() => setChatId(chat.id)}
															className="flex min-w-0 flex-1 cursor-pointer"
														>
															<span className="block truncate text-left">
																{title}
															</span>
														</button>
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
																	onClick={(e) => e.stopPropagation()}
																>
																	<MoreHorizontalIcon className="size-3.5" />
																	<span className="sr-only">Chat options</span>
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent side="right" align="start">
																<DropdownMenuItem
																	onClick={() =>
																		NiceModal.show(RenameChatModal, {
																			chatId: chat.id,
																			currentTitle: title,
																		})
																	}
																>
																	Rename
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() => togglePin(chat.id)}
																>
																	{chat.pinned ? "Unpin" : "Pin"}
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	onClick={() => deleteChat(chat.id)}
																	className="text-destructive focus:text-destructive"
																>
																	Delete
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
												);
											})}
										</div>
									</div>
								))}
						</div>
					</ScrollArea>
				</div>
			</div>

			{/* Main Chat Area */}
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				{/* Toggle Sidebar Button */}
				<div className="absolute top-3 left-3 z-10">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setSidebarOpen(!sidebarOpen)}
						className="size-8"
						aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
					>
						{sidebarOpen ? (
							<PanelLeftCloseIcon className="size-4" />
						) : (
							<PanelLeftIcon className="size-4" />
						)}
					</Button>
				</div>

				{/* Messages */}
				<Conversation className="min-h-0 flex-1">
					<ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-8 pt-16">
						{isLoadingChat ? (
							<div className="flex flex-1 items-center justify-center">
								<Loader size={24} />
							</div>
						) : messages.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
								<div className="flex flex-col gap-2">
									<h2 className="font-semibold text-2xl">
										How can I help you today?
									</h2>
									<p className="text-muted-foreground">
										Ask me anything and I'll do my best to help.
									</p>
								</div>
								<Suggestions className="mt-4 flex-wrap justify-center">
									<Suggestion
										suggestion="Help me draft a follow-up email"
										onClick={handleSendMessage}
									/>
									<Suggestion
										suggestion="Write a cold email for a SaaS product"
										onClick={handleSendMessage}
									/>
									<Suggestion
										suggestion="Give me tips for closing deals"
										onClick={handleSendMessage}
									/>
									<Suggestion
										suggestion="How can I improve my pipeline?"
										onClick={handleSendMessage}
									/>
								</Suggestions>
							</div>
						) : (
							messages.map((message) => {
								const isError = (message as any).isError;
								return (
									<Message
										key={message.id}
										from={message.role}
										isError={isError}
									>
										<div
											className={cn(
												"flex w-full gap-4",
												message.role === "user" && "flex-row-reverse",
											)}
										>
											{message.role === "assistant" ? (
												<Avatar className="size-8 shrink-0">
													<AvatarFallback className="bg-primary text-primary-foreground">
														<SparklesIcon className="size-4" />
													</AvatarFallback>
												</Avatar>
											) : (
												<UserAvatar
													name={user?.name ?? "User"}
													src={user?.image}
													className="size-8 shrink-0"
												/>
											)}
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<MessageContent
													isError={isError}
													className={cn(
														"max-w-none",
														message.role === "user" &&
															"rounded-2xl bg-secondary px-4 py-3",
													)}
												>
													{message.role === "assistant" ? (
														<MessageResponse>
															{getMessageText(message)}
														</MessageResponse>
													) : (
														<span className="whitespace-pre-wrap">
															{getMessageText(message)}
														</span>
													)}
												</MessageContent>
												<div
													className={cn(
														"flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100",
														message.role === "user" && "justify-end",
													)}
												>
													<MessageCopyButton
														content={getMessageText(message)}
													/>
													{message.role === "assistant" &&
														message.id === messages[messages.length - 1]?.id &&
														!isStreaming && (
															<Button
																variant="ghost"
																size="icon"
																className="size-7"
																onClick={handleRegenerate}
															>
																<RefreshCwIcon className="size-3.5" />
																<span className="sr-only">
																	Regenerate response
																</span>
															</Button>
														)}
												</div>
											</div>
										</div>
									</Message>
								);
							})
						)}

						{isStreaming && messages[messages.length - 1]?.role === "user" && (
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
											<span>Thinking...</span>
										</div>
									</MessageContent>
								</div>
							</Message>
						)}

						{status === "error" &&
							messages[messages.length - 1]?.role === "user" && (
								<Message from="assistant">
									<div className="flex w-full gap-4">
										<Avatar className="size-8 shrink-0">
											<AvatarFallback className="bg-destructive text-destructive-foreground">
												<AlertCircleIcon className="size-4" />
											</AvatarFallback>
										</Avatar>
										<MessageContent className="max-w-none flex-1">
											<div className="flex flex-col gap-2">
												<span className="text-destructive">
													Failed to generate response
												</span>
												<Button
													variant="outline"
													size="sm"
													onClick={handleRegenerate}
													className="w-fit"
												>
													<RefreshCwIcon className="size-3.5" />
													Try again
												</Button>
											</div>
										</MessageContent>
									</div>
								</Message>
							)}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				{/* Input Area - Fixed at bottom */}
				<div className="shrink-0 bg-background/80 p-4 backdrop-blur-sm">
					<div className="mx-auto w-full max-w-3xl">
						<PromptInput
							onSubmit={onSubmit}
							className="rounded-2xl border shadow-lg"
						>
							<PromptInputTextarea
								value={input}
								onValueChange={setInput}
								disabled={!hasChat || isStreaming}
								placeholder="Ask me anything..."
								className="min-h-[52px] rounded-2xl border-0 px-4 py-3"
							/>
							<PromptInputFooter className="px-3 pb-3">
								<PromptInputTools>
									<Select
										value={selectedModel}
										onValueChange={(value) =>
											setSelectedModel(value as ChatModelId)
										}
										disabled={isStreaming}
									>
										<SelectTrigger
											size="sm"
											className="h-8 w-auto gap-1.5 border-0 bg-transparent px-2 text-muted-foreground shadow-none hover:bg-accent hover:text-foreground focus-visible:ring-0"
										>
											<SelectValue>
												{chatModels.find((m) => m.id === selectedModel)?.name}
											</SelectValue>
										</SelectTrigger>
										<SelectContent align="start" className="w-72">
											{chatModels.map((model) => (
												<SelectItem
													key={model.id}
													value={model.id}
													textValue={model.name}
													className="py-2.5"
												>
													<div className="flex items-start gap-3 text-left">
														<div className="flex flex-1 flex-col gap-0.5">
															<span className="font-medium">{model.name}</span>
															<span className="flex items-center gap-1 text-muted-foreground text-xs">
																{model.description}
																<span className="text-muted-foreground/60">
																	·
																</span>
																<span className="inline-flex items-center gap-0.5">
																	<CoinsIcon className="size-3" />~
																	{getChatModelCostEstimate(model.id)}
																</span>
															</span>
														</div>
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</PromptInputTools>
								<div className="flex items-center gap-1">
									{isStreaming ? (
										<Button
											type="button"
											size="icon"
											variant="outline"
											onClick={() => stop()}
											className="size-8 rounded-xl"
										>
											<span className="sr-only">Stop generating</span>
											<div className="size-3 rounded-sm bg-current" />
										</Button>
									) : (
										<PromptInputSubmit
											status={chatStatus}
											disabled={!hasChat || !input.trim()}
											className="rounded-xl"
										/>
									)}
								</div>
							</PromptInputFooter>
						</PromptInput>
						<p className="mt-2 text-center text-muted-foreground text-xs">
							AI can make mistakes. Consider checking important information.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
