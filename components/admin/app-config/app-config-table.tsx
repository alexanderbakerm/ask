"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Copy, InfoIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/custom/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { appConfig } from "@/config/app.config";
import { authConfig } from "@/config/auth.config";
import { billingConfig } from "@/config/billing.config";
import { storageConfig } from "@/config/storage.config";

type ConfigRow = { key: string; type: string; value: unknown };

function flattenConfigToRows(obj: unknown, prefix = ""): ConfigRow[] {
	if (typeof obj !== "object" || obj === null) {
		return [];
	}

	let rows: ConfigRow[] = [];
	for (const key of Object.keys(obj)) {
		const value = (obj as Record<string, unknown>)[key];
		const jsType = typeof value;
		let displayType: string = jsType;
		if (Array.isArray(value)) displayType = "array";
		else if (value === null) displayType = "null";
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (jsType === "object" && value !== null && !Array.isArray(value)) {
			rows = rows.concat(flattenConfigToRows(value, fullKey));
		} else if (Array.isArray(value)) {
			// Show array as a single row, do not expand
			rows.push({ key: fullKey, type: "array", value });
		} else {
			rows.push({ key: fullKey, type: displayType, value });
		}
	}
	return rows;
}

function valuePreviewString(value: unknown, type: string): string[] | string {
	if (type === "array") {
		// Show array values, each on a new line
		try {
			if (Array.isArray(value)) {
				return value.map((item) => {
					if (typeof item === "object" && item !== null) {
						return JSON.stringify(item, null, 2);
					}
					return String(item);
				});
			}
			return [String(value)];
		} catch {
			return ["(array)"];
		}
	}
	if (type === "object") return "(object)";
	if (type === "boolean") return value ? "true" : "false";
	if (type === "string" && typeof value === "string") {
		// Split multi-line strings into lines
		return value.split("\n");
	}
	if (type === "null" || value === null) return "null";
	if (typeof value === "undefined") return "undefined";
	return String(value ?? "");
}

function ValueCell({ value, type }: { value: unknown; type: string }) {
	const str = valuePreviewString(value, type);
	const handleCopy = () => {
		let copyText: string;
		if (typeof value === "string") {
			copyText = value;
		} else if (typeof value === "object" && value !== null) {
			copyText = JSON.stringify(value, null, 2);
		} else {
			copyText = String(value);
		}
		navigator.clipboard.writeText(copyText);
		toast.success("Copied!");
	};
	return (
		<div className="flex min-w-0 items-center gap-2">
			<TooltipProvider>
				<span className="whitespace-pre-line wrap-break-word text-foreground/90">
					{Array.isArray(str)
						? str.map((line, idx) => <div key={idx}>{line}</div>)
						: str}
				</span>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 p-0 text-muted-foreground hover:bg-accent/40"
							onClick={handleCopy}
							aria-label="Copy value"
						>
							<Copy size={14} />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Copy value</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}

const columns: ColumnDef<ConfigRow>[] = [
	{
		accessorKey: "key",
		header: () => (
			<div className="font-medium text-foreground text-xs">Key</div>
		),
		cell: ({ row }) => (
			<span className="whitespace-nowrap align-top font-mono text-foreground/90">
				{row.original.key}
			</span>
		),
	},
	{
		accessorKey: "type",
		header: () => (
			<div className="font-medium text-foreground text-xs">Type</div>
		),
		cell: ({ row }) => (
			<Badge className="rounded border-none bg-muted px-2 py-0.5 font-normal text-muted-foreground text-xs">
				{row.original.type}
			</Badge>
		),
	},
	{
		accessorKey: "value",
		header: () => (
			<div className="font-medium text-foreground text-xs">Value</div>
		),
		cell: ({ row }) => (
			<ValueCell value={row.original.value} type={row.original.type} />
		),
	},
];

type ConfigSection = {
	id: string;
	label: string;
	description: string;
	configFile: string;
	data: unknown;
};

const configSections: ConfigSection[] = [
	{
		id: "app",
		label: "App",
		description:
			"Core application settings like name, description, and contact information.",
		configFile: "config/app.config.ts",
		data: appConfig,
	},
	{
		id: "auth",
		label: "Auth",
		description:
			"Authentication and CORS settings including redirects, session duration, social login, and allowed origins.",
		configFile: "config/auth.config.ts",
		data: authConfig,
	},
	{
		id: "billing",
		label: "Billing",
		description:
			"Billing configuration including plans, pricing, and payment settings.",
		configFile: "config/billing.config.ts",
		data: billingConfig,
	},
	{
		id: "storage",
		label: "Storage",
		description:
			"Storage configuration for file uploads and bucket management.",
		configFile: "config/storage.config.ts",
		data: storageConfig,
	},
];

function ConfigTable({ data }: { data: unknown }) {
	const rows = React.useMemo(() => flattenConfigToRows(data), [data]);

	return (
		<DataTable
			data={rows}
			columns={columns}
			totalCount={rows.length}
			enableSearch={false}
			enableFilters={false}
			enablePagination={false}
			enableRowSelection={false}
		/>
	);
}

export function AppConfigTable(): React.JSX.Element {
	return (
		<>
			<Alert className="my-6">
				<InfoIcon />
				<AlertDescription className="inline">
					Application configuration is split across multiple files in the{" "}
					<strong>config/</strong> directory. Most values cannot be changed
					during runtime.
				</AlertDescription>
			</Alert>
			<Tabs defaultValue="app" className="w-full">
				<TabsList className="mb-4">
					{configSections.map((section) => (
						<TabsTrigger key={section.id} value={section.id}>
							{section.label}
						</TabsTrigger>
					))}
				</TabsList>
				{configSections.map((section) => (
					<TabsContent key={section.id} value={section.id}>
						<div className="mb-4 space-y-1">
							<p className="text-muted-foreground text-sm">
								{section.description}
							</p>
							<p className="font-mono text-muted-foreground/70 text-xs">
								{section.configFile}
							</p>
						</div>
						<ConfigTable data={section.data} />
					</TabsContent>
				))}
			</Tabs>
		</>
	);
}
