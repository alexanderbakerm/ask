"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { InfoIcon, MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import type { AskBiAnswer } from "@/lib/ai/askbi/viz/spec";
import { trpc } from "@/trpc/client";
import { AskBiAnswerView } from "./askbi-answer";

type OpenResult =
	| { ok: true; answer: AskBiAnswer; asOf: string }
	| { ok: false; status: string; error: string };

export type SavedQueriesSheetProps = NiceModalHocProps;

export const SavedQueriesSheet = NiceModal.create<SavedQueriesSheetProps>(
	() => {
		const modal = useEnhancedModal();
		const utils = trpc.useUtils();
		const { data, isPending } = trpc.organization.savedQuery.list.useQuery();
		const saved = data?.savedQueries ?? [];

		const [opened, setOpened] = useState<{
			name: string;
			result: OpenResult;
		} | null>(null);
		const [renamingId, setRenamingId] = useState<string | null>(null);
		const [renameValue, setRenameValue] = useState("");

		const openMutation = trpc.organization.savedQuery.open.useMutation();
		const renameMutation = trpc.organization.savedQuery.rename.useMutation({
			onSuccess: () => {
				utils.organization.savedQuery.list.invalidate();
				setRenamingId(null);
			},
			onError: (e) => toast.error(e.message || "Failed to rename"),
		});
		const deleteMutation = trpc.organization.savedQuery.delete.useMutation({
			onSuccess: () => {
				toast.success("Saved query deleted");
				utils.organization.savedQuery.list.invalidate();
			},
			onError: (e) => toast.error(e.message || "Failed to delete"),
		});

		const open = async (id: string, name: string) => {
			try {
				const result = (await openMutation.mutateAsync({ id })) as OpenResult;
				setOpened({ name, result });
			} catch (e) {
				toast.error(e instanceof Error ? e.message : "Failed to open");
			}
		};

		return (
			<Sheet
				open={modal.visible}
				onOpenChange={(o) => !o && modal.handleClose()}
			>
				<SheetContent
					className="sm:max-w-xl"
					onAnimationEndCapture={modal.handleAnimationEndCapture}
				>
					<SheetHeader>
						<SheetTitle>Saved queries</SheetTitle>
						<SheetDescription>
							Your saved questions. Opening one re-runs its SQL for current
							data.
						</SheetDescription>
					</SheetHeader>

					<ScrollArea className="flex-1">
						<div className="space-y-4 px-6 py-4">
							{opened && (
								<div className="space-y-2 rounded-lg border p-3">
									<div className="flex items-center justify-between">
										<span className="font-medium text-sm">{opened.name}</span>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setOpened(null)}
										>
											Close
										</Button>
									</div>
									{opened.result.ok ? (
										<>
											<AskBiAnswerView answer={opened.result.answer} />
											<p className="text-muted-foreground text-xs">
												Fresh as of{" "}
												{new Date(opened.result.asOf).toLocaleTimeString()}
											</p>
										</>
									) : (
										<div className="flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-amber-900 text-xs dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
											<InfoIcon className="size-3.5 shrink-0" />
											<span>{opened.result.error}</span>
										</div>
									)}
								</div>
							)}

							{isPending ? (
								<div className="space-y-2">
									<Skeleton className="h-14 w-full" />
									<Skeleton className="h-14 w-full" />
								</div>
							) : saved.length === 0 ? (
								<Empty>
									<EmptyTitle>No saved queries yet</EmptyTitle>
									<EmptyDescription>
										Ask a question, then “Save” its answer to revisit it with
										fresh data later.
									</EmptyDescription>
								</Empty>
							) : (
								<div className="space-y-1">
									{saved.map((q) => (
										<div
											key={q.id}
											className="flex items-center gap-2 rounded-lg border px-3 py-2"
										>
											<div className="min-w-0 flex-1">
												{renamingId === q.id ? (
													<Input
														value={renameValue}
														onChange={(e) => setRenameValue(e.target.value)}
														onBlur={() =>
															renameMutation.mutate({
																id: q.id,
																name: renameValue.trim() || q.name,
															})
														}
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																renameMutation.mutate({
																	id: q.id,
																	name: renameValue.trim() || q.name,
																});
															}
															if (e.key === "Escape") setRenamingId(null);
														}}
														className="h-8"
														autoFocus
													/>
												) : (
													<>
														<div className="truncate font-medium text-sm">
															{q.name}
														</div>
														{q.question && (
															<div className="truncate text-muted-foreground text-xs">
																{q.question}
															</div>
														)}
													</>
												)}
											</div>
											<Button
												variant="outline"
												size="sm"
												loading={
													openMutation.isPending &&
													openMutation.variables?.id === q.id
												}
												onClick={() => open(q.id, q.name)}
											>
												Open
											</Button>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="size-8"
													>
														<MoreHorizontalIcon className="size-4" />
														<span className="sr-only">Actions</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => {
															setRenamingId(q.id);
															setRenameValue(q.name);
														}}
													>
														Rename
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														variant="destructive"
														onClick={() =>
															NiceModal.show(ConfirmationModal, {
																title: "Delete saved query?",
																message: `Delete “${q.name}”? This cannot be undone.`,
																confirmLabel: "Delete",
																destructive: true,
																onConfirm: () =>
																	deleteMutation.mutate({ id: q.id }),
															})
														}
													>
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									))}
								</div>
							)}
						</div>
					</ScrollArea>
				</SheetContent>
			</Sheet>
		);
	},
);
