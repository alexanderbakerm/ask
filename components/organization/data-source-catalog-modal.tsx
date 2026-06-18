"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { KeyRoundIcon, TableIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
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
import { trpc } from "@/trpc/client";

export type DataSourceCatalogModalProps = NiceModalHocProps & {
	dataSourceId: string;
	dataSourceName: string;
};

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((v): v is string => typeof v === "string")
		: [];
}

export const DataSourceCatalogModal =
	NiceModal.create<DataSourceCatalogModalProps>(
		({ dataSourceId, dataSourceName }) => {
			const modal = useEnhancedModal();
			const { data, isPending } =
				trpc.organization.dataSource.getCatalog.useQuery({ id: dataSourceId });

			const tables = data?.catalog.tables ?? [];

			return (
				<Sheet
					open={modal.visible}
					onOpenChange={(open) => !open && modal.handleClose()}
				>
					<SheetContent
						className="sm:max-w-xl"
						onAnimationEndCapture={modal.handleAnimationEndCapture}
					>
						<SheetHeader>
							<SheetTitle>Catalog — {dataSourceName}</SheetTitle>
							<SheetDescription>
								The introspected schema AskBI uses to ground queries. Distinct
								counts are approximate (sampled).
							</SheetDescription>
						</SheetHeader>

						<ScrollArea className="flex-1">
							<div className="space-y-6 px-6 py-4">
								{isPending ? (
									<div className="space-y-3">
										<Skeleton className="h-6 w-40" />
										<Skeleton className="h-24 w-full" />
										<Skeleton className="h-24 w-full" />
									</div>
								) : tables.length === 0 ? (
									<Empty>
										<EmptyTitle>No catalog yet</EmptyTitle>
										<EmptyDescription>
											Introspection hasn't produced any tables. Try
											“Reintrospect”, or check the connection.
										</EmptyDescription>
									</Empty>
								) : (
									tables.map((table) => (
										<div
											key={`${table.schema}.${table.name}`}
											className="rounded-lg border"
										>
											<div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
												<TableIcon className="size-4 shrink-0 text-muted-foreground" />
												<span className="font-medium text-sm">
													{table.schema}.{table.name}
												</span>
												{typeof table.rowCountEstimate === "number" && (
													<span className="ml-auto text-muted-foreground text-xs">
														~{table.rowCountEstimate.toLocaleString()} rows
														(est.)
													</span>
												)}
											</div>
											<div className="divide-y">
												{table.columns.map((column) => {
													const samples = asStringArray(column.sampleValues);
													return (
														<div
															key={column.name}
															className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
														>
															<span className="font-mono">{column.name}</span>
															{column.isPrimaryKey && (
																<KeyRoundIcon className="size-3 text-amber-500" />
															)}
															<Badge
																variant="secondary"
																className="font-normal"
															>
																{column.normalizedType}
															</Badge>
															{column.isNullable && (
																<span className="text-muted-foreground text-xs">
																	nullable
																</span>
															)}
															{typeof column.distinctCount === "number" && (
																<span className="text-muted-foreground text-xs">
																	~{column.distinctCount.toLocaleString()}{" "}
																	distinct (approx)
																</span>
															)}
															{samples.length > 0 && (
																<span className="w-full truncate text-muted-foreground text-xs">
																	e.g. {samples.slice(0, 5).join(", ")}
																</span>
															)}
														</div>
													);
												})}
											</div>
										</div>
									))
								)}
							</div>
						</ScrollArea>
					</SheetContent>
				</Sheet>
			);
		},
	);
