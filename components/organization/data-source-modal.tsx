"use client";

import NiceModal, { type NiceModalHocProps } from "@ebay/nice-modal-react";
import { UploadIcon } from "lucide-react";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription } from "@/components/ui/field";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useEnhancedModal } from "@/hooks/use-enhanced-modal";
import { useZodForm } from "@/hooks/use-zod-form";
import { type ParsedCsv, parseCsv } from "@/lib/datasources/csv-import";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

// Non-secret fields needed to pre-fill the edit form. The password is never
// returned by the API (`hasCredentials` only), so it is never pre-filled.
interface DataSourceEditTarget {
	id: string;
	name: string;
	config: {
		host: string;
		port: number;
		database: string;
		user: string;
		ssl: boolean;
		schemas: string[];
	};
}

export type DataSourceModalProps = NiceModalHocProps & {
	dataSource?: DataSourceEditTarget;
};

// Flat form schema (UI only); mapped to the nested API input on submit.
const dataSourceFormSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(200),
	host: z.string().trim().min(1, "Host is required").max(255),
	port: z.number().int().min(1).max(65535),
	database: z.string().trim().min(1, "Database is required").max(255),
	user: z.string().trim().min(1, "User is required").max(255),
	password: z.string().max(1024).optional(),
	ssl: z.boolean(),
	schemas: z.string().trim().min(1, "At least one schema is required"),
});

const DEMO_CONNECTION = {
	name: "Demo (askbi_demo)",
	host: "localhost",
	port: 5432,
	database: "askbi_demo",
	user: "askbi_readonly",
	password: "askbi_readonly_password",
	ssl: false,
	schemas: "sales",
};

const MAX_CSV_BYTES = 8_000_000;
type Mode = "database" | "csv";

export const DataSourceModal = NiceModal.create<DataSourceModalProps>(
	({ dataSource }) => {
		const modal = useEnhancedModal();
		const utils = trpc.useUtils();
		const isEditing = !!dataSource;
		const [mode, setMode] = useState<Mode>("database");

		const onSettled = (
			result: { dataSource: { status: string; lastError: string | null } },
			verb: string,
		) => {
			utils.organization.dataSource.list.invalidate();
			if (result.dataSource.status === "connected") {
				toast.success(`Data source ${verb} and connected`);
			} else {
				toast.error(
					result.dataSource.lastError ??
						`Data source ${verb}, but the connection failed`,
				);
			}
			modal.handleClose();
		};

		const createMutation = trpc.organization.dataSource.create.useMutation({
			onSuccess: (result) => onSettled(result, "created"),
			onError: (error) => toast.error(error.message || "Failed to create"),
		});
		const updateMutation = trpc.organization.dataSource.update.useMutation({
			onSuccess: (result) => onSettled(result, "updated"),
			onError: (error) => toast.error(error.message || "Failed to update"),
		});
		const importMutation = trpc.organization.dataSource.importCsv.useMutation({
			onSuccess: (result) => {
				utils.organization.dataSource.list.invalidate();
				const rows = result.rowCount.toLocaleString();
				if (result.dataSource.status === "connected") {
					toast.success(
						`Imported ${rows} rows${result.truncated ? " (truncated)" : ""}`,
					);
				} else {
					toast.error(
						result.dataSource.lastError ?? "Imported, but introspection failed",
					);
				}
				modal.handleClose();
			},
			onError: (error) => toast.error(error.message || "Failed to import CSV"),
		});

		const form = useZodForm({
			schema: dataSourceFormSchema,
			defaultValues: isEditing
				? {
						name: dataSource.name,
						host: dataSource.config.host,
						port: dataSource.config.port,
						database: dataSource.config.database,
						user: dataSource.config.user,
						password: "",
						ssl: dataSource.config.ssl,
						schemas: dataSource.config.schemas.join(", "),
					}
				: {
						name: "",
						host: "",
						port: 5432,
						database: "",
						user: "",
						password: "",
						ssl: true,
						schemas: "public",
					},
		});

		const onSubmit = form.handleSubmit((data) => {
			const schemas = data.schemas
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);
			const connectionBase = {
				host: data.host,
				port: data.port,
				database: data.database,
				user: data.user,
				ssl: data.ssl,
				schemas,
			};

			if (isEditing) {
				updateMutation.mutate({
					id: dataSource.id,
					name: data.name,
					connection: {
						...connectionBase,
						...(data.password ? { password: data.password } : {}),
					},
				});
			} else {
				createMutation.mutate({
					name: data.name,
					type: "postgres",
					connection: { ...connectionBase, password: data.password ?? "" },
				});
			}
		});

		// ---- CSV import state ----
		const [csvName, setCsvName] = useState("");
		const [csvText, setCsvText] = useState("");
		const [hasHeader, setHasHeader] = useState(true);
		const [csvError, setCsvError] = useState<string | null>(null);

		const preview: ParsedCsv | null = useMemo(() => {
			if (!csvText) return null;
			try {
				return parseCsv(csvText, hasHeader);
			} catch {
				return null;
			}
		}, [csvText, hasHeader]);

		const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			setCsvError(null);
			if (!file) return;
			if (file.size > MAX_CSV_BYTES) {
				setCsvError("File is too large (8MB max).");
				setCsvText("");
				return;
			}
			const text = await file.text();
			setCsvText(text);
			if (!csvName) setCsvName(file.name.replace(/\.csv$/i, ""));
		};

		const onCsvSubmit = (e: FormEvent) => {
			e.preventDefault();
			if (!csvText || !preview || preview.columns.length === 0) {
				setCsvError("Choose a CSV file with at least one column.");
				return;
			}
			importMutation.mutate({
				name: csvName.trim() || "Imported CSV",
				csv: csvText,
				hasHeader,
			});
		};

		const isPending =
			createMutation.isPending ||
			updateMutation.isPending ||
			importMutation.isPending;
		const showCsv = !isEditing && mode === "csv";

		return (
			<Sheet
				open={modal.visible}
				onOpenChange={(open) => !open && modal.handleClose()}
			>
				<SheetContent
					className="sm:max-w-lg"
					onAnimationEndCapture={modal.handleAnimationEndCapture}
				>
					<SheetHeader>
						<SheetTitle>
							{isEditing ? "Edit data source" : "Connect a data source"}
						</SheetTitle>
						<SheetDescription>
							{showCsv
								? "Upload a CSV. We load it into a private table and AskBI charts it automatically."
								: "PostgreSQL. Use read-only credentials — AskBI only ever runs SELECT queries."}
						</SheetDescription>
					</SheetHeader>

					{!isEditing && (
						<div className="grid grid-cols-2 gap-2 px-6 pt-4">
							<Button
								type="button"
								variant={mode === "database" ? "default" : "outline"}
								onClick={() => setMode("database")}
							>
								Connect database
							</Button>
							<Button
								type="button"
								variant={mode === "csv" ? "default" : "outline"}
								onClick={() => setMode("csv")}
							>
								Import CSV
							</Button>
						</div>
					)}

					{showCsv ? (
						<form
							onSubmit={onCsvSubmit}
							className="flex flex-1 flex-col overflow-hidden"
						>
							<ScrollArea className="flex-1">
								<div className="space-y-4 px-6 py-4">
									<Field>
										<Label htmlFor="csv-name">Name</Label>
										<Input
											id="csv-name"
											placeholder="Q3 sales export"
											value={csvName}
											onChange={(e) => setCsvName(e.target.value)}
											autoComplete="off"
										/>
									</Field>

									<Field>
										<Label htmlFor="csv-file">CSV file</Label>
										<Input
											id="csv-file"
											type="file"
											accept=".csv,text/csv"
											onChange={onFileChange}
										/>
										<FieldDescription>
											Up to 8MB. The first row should be column headers.
										</FieldDescription>
										{csvError && (
											<p className="text-destructive text-sm">{csvError}</p>
										)}
									</Field>

									<Field orientation="horizontal" className="justify-between">
										<div className="space-y-0.5">
											<Label>First row is a header</Label>
											<FieldDescription>
												Otherwise columns are named column_1, column_2, …
											</FieldDescription>
										</div>
										<Switch checked={hasHeader} onCheckedChange={setHasHeader} />
									</Field>

									{preview && preview.columns.length > 0 && (
										<div className="rounded-lg border">
											<div className="border-b px-3 py-2 text-muted-foreground text-xs">
												{preview.columns.length} columns ·{" "}
												{preview.rows.length.toLocaleString()} rows detected
											</div>
											<div className="max-h-56 divide-y overflow-auto">
												{preview.columns.map((col) => (
													<div
														key={col.name}
														className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
													>
														<span className="truncate font-medium">
															{col.label}
														</span>
														<span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
															{col.kind}
														</span>
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							</ScrollArea>

							<SheetFooter className="flex-row justify-end gap-2 border-t">
								<Button
									type="button"
									variant="outline"
									onClick={modal.handleClose}
									disabled={isPending}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={isPending || !preview}
									loading={importMutation.isPending}
								>
									<UploadIcon className="size-4" />
									Import
								</Button>
							</SheetFooter>
						</form>
					) : (
						<Form {...form}>
							<form
								onSubmit={onSubmit}
								className="flex flex-1 flex-col overflow-hidden"
							>
								<ScrollArea className="flex-1">
									<div className="space-y-4 px-6 py-4">
										{process.env.NODE_ENV === "development" && !isEditing && (
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => form.reset(DEMO_CONNECTION)}
											>
												Load demo connection
											</Button>
										)}

										<FormField
											control={form.control}
											name="name"
											render={({ field }) => (
												<FormItem asChild>
													<Field>
														<FormLabel>Name</FormLabel>
														<FormControl>
															<Input
																placeholder="Production analytics"
																autoComplete="off"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</Field>
												</FormItem>
											)}
										/>

										<div className="grid grid-cols-3 gap-4">
											<div className="col-span-2">
												<FormField
													control={form.control}
													name="host"
													render={({ field }) => (
														<FormItem asChild>
															<Field>
																<FormLabel>Host</FormLabel>
																<FormControl>
																	<Input
																		placeholder="db.example.com"
																		autoComplete="off"
																		{...field}
																	/>
																</FormControl>
																<FormMessage />
															</Field>
														</FormItem>
													)}
												/>
											</div>
											<FormField
												control={form.control}
												name="port"
												render={({ field }) => (
													<FormItem asChild>
														<Field>
															<FormLabel>Port</FormLabel>
															<FormControl>
																<Input
																	type="number"
																	autoComplete="off"
																	{...field}
																	value={field.value ?? ""}
																	onChange={(e) =>
																		field.onChange(
																			e.target.value
																				? Number(e.target.value)
																				: "",
																		)
																	}
																/>
															</FormControl>
															<FormMessage />
														</Field>
													</FormItem>
												)}
											/>
										</div>

										<FormField
											control={form.control}
											name="database"
											render={({ field }) => (
												<FormItem asChild>
													<Field>
														<FormLabel>Database</FormLabel>
														<FormControl>
															<Input
																placeholder="analytics"
																autoComplete="off"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</Field>
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="user"
											render={({ field }) => (
												<FormItem asChild>
													<Field>
														<FormLabel>User</FormLabel>
														<FormControl>
															<Input
																placeholder="readonly_user"
																autoComplete="off"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</Field>
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="password"
											render={({ field }) => (
												<FormItem asChild>
													<Field>
														<FormLabel>Password</FormLabel>
														<FormControl>
															<Input
																type="password"
																autoComplete="off"
																placeholder={isEditing ? "••••••••" : undefined}
																{...field}
																value={field.value ?? ""}
															/>
														</FormControl>
														{isEditing && (
															<FieldDescription>
																Leave blank to keep the existing credential.
															</FieldDescription>
														)}
														<FormMessage />
													</Field>
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="schemas"
											render={({ field }) => (
												<FormItem asChild>
													<Field>
														<FormLabel>Schemas</FormLabel>
														<FormControl>
															<Input
																placeholder="public"
																autoComplete="off"
																{...field}
															/>
														</FormControl>
														<FieldDescription>
															Comma-separated. AskBI only introspects and queries
															these schemas.
														</FieldDescription>
														<FormMessage />
													</Field>
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="ssl"
											render={({ field }) => (
												<FormItem asChild>
													<Field
														orientation="horizontal"
														className="justify-between"
													>
														<div className="space-y-0.5">
															<FormLabel>Require SSL</FormLabel>
															<FieldDescription>
																Encrypt the connection in transit.
															</FieldDescription>
														</div>
														<FormControl>
															<Switch
																checked={field.value}
																onCheckedChange={field.onChange}
															/>
														</FormControl>
													</Field>
												</FormItem>
											)}
										/>
									</div>
								</ScrollArea>

								<SheetFooter className="flex-row justify-end gap-2 border-t">
									<Button
										type="button"
										variant="outline"
										onClick={modal.handleClose}
										disabled={isPending}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={isPending} loading={isPending}>
										{isEditing ? "Save changes" : "Connect"}
									</Button>
								</SheetFooter>
							</form>
						</Form>
					)}
				</SheetContent>
			</Sheet>
		);
	},
);
