import pino, { type Logger as PinoLogger } from "pino";
import { env } from "@/lib/env";

// Dynamically import context to avoid client-side issues and support edge runtime
let getFilteredRequestContext: (() => Record<string, unknown>) | undefined;

if (typeof window === "undefined") {
	const isEdgeRuntime =
		typeof process === "undefined" || !process.versions?.node;

	if (isEdgeRuntime) {
		getFilteredRequestContext = () => ({});
	} else {
		try {
			// biome-ignore lint/security/noGlobalEval: Required for conditional server-side module loading
			const contextModule = eval("require")("@/lib/logger/context");
			getFilteredRequestContext = contextModule.getFilteredRequestContext;
		} catch {
			getFilteredRequestContext = () => ({});
		}
	}
} else {
	getFilteredRequestContext = () => ({});
}

const COLOR = {
	GREEN: "\x1b[32m",
	RED: "\x1b[31m",
	WHITE: "\x1b[37m",
	YELLOW: "\x1b[33m",
	CYAN: "\x1b[36m",
	BLUE: "\x1b[34m",
	MAGENTA: "\x1b[35m",
	BRIGHT_GREEN: "\x1b[92m",
	BRIGHT_BLUE: "\x1b[94m",
	BRIGHT_MAGENTA: "\x1b[95m",
	BRIGHT_CYAN: "\x1b[96m",
	BRIGHT_YELLOW: "\x1b[93m",
	DIM: "\x1b[2m",
	RESET: "\x1b[0m",
};

const LEVEL_COLORS: Record<string, string> = {
	FATAL: COLOR.RED,
	ERROR: COLOR.RED,
	WARN: COLOR.YELLOW,
	INFO: COLOR.GREEN,
	DEBUG: COLOR.GREEN,
	TRACE: COLOR.GREEN,
};

// Predefined colors for specific groups
const GROUP_COLORS: Record<string, string> = {
	default: COLOR.CYAN,
	app: COLOR.CYAN,
	Billing: COLOR.BRIGHT_MAGENTA,
	Auth: COLOR.BRIGHT_BLUE,
	Webhook: COLOR.MAGENTA,
	Database: COLOR.YELLOW,
	API: COLOR.GREEN,
	Organization: COLOR.BRIGHT_CYAN,
	User: COLOR.BRIGHT_YELLOW,
	Email: COLOR.BLUE,
	Storage: COLOR.BRIGHT_GREEN,
};

// Available colors for auto-assignment to new groups
const AVAILABLE_COLORS = [
	COLOR.CYAN,
	COLOR.BRIGHT_MAGENTA,
	COLOR.BRIGHT_BLUE,
	COLOR.BRIGHT_GREEN,
	COLOR.MAGENTA,
	COLOR.BLUE,
	COLOR.BRIGHT_CYAN,
	COLOR.BRIGHT_YELLOW,
	COLOR.GREEN,
];

// Cache for dynamically assigned group colors
const groupColorCache = new Map<string, string>();

function getGroupColor(group: string): string {
	// Check predefined colors first
	if (GROUP_COLORS[group]) {
		return GROUP_COLORS[group];
	}

	// Check cache for previously assigned colors
	if (groupColorCache.has(group)) {
		const cachedColor = groupColorCache.get(group);
		if (cachedColor) {
			return cachedColor;
		}
	}

	// Assign a new color based on group name hash
	const hash = group
		.split("")
		.reduce((acc, char) => acc + char.charCodeAt(0), 0);
	const colorIndex = hash % AVAILABLE_COLORS.length;
	const assignedColor = AVAILABLE_COLORS[colorIndex] ?? COLOR.CYAN;

	// Cache the assignment
	groupColorCache.set(group, assignedColor);

	return assignedColor;
}

function formatTime(date: Date): string {
	const pad = (num: number, size = 2) => num.toString().padStart(size, "0");
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());
	const milliseconds = pad(date.getMilliseconds(), 3);
	return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export class Logger {
	private logger: PinoLogger;

	constructor(group = "app") {
		const logLevel = env.NEXT_PUBLIC_LOG_LEVEL || "info";
		const isDevelopment = env.NEXT_PUBLIC_NODE_ENV === "development";
		const isTest = env.NEXT_PUBLIC_NODE_ENV === "test";
		const usePrettyLogs = isDevelopment || isTest;

		// Create custom destination for pretty logs
		const destination =
			usePrettyLogs && typeof window === "undefined"
				? {
						write: (chunk: string) => {
							try {
								const logObj = JSON.parse(chunk);
								const { level, msg, group: logGroup, ...rest } = logObj;

								const levelUppercased = (level || "info").toUpperCase();
								const LEVEL_COLOR =
									LEVEL_COLORS[levelUppercased] || COLOR.WHITE;
								const GROUP_COLOR = getGroupColor(logGroup || "default");

								// Simple format: [LEVEL] group: message
								let output = `[${LEVEL_COLOR}${levelUppercased}${COLOR.RESET}] ${GROUP_COLOR}${logGroup}${COLOR.RESET}: ${msg}`;

								// Add context if present
								const contextKeys = Object.keys(rest).filter(
									(key) =>
										!["pid", "hostname", "levelValue", "time"].includes(key),
								);
								if (contextKeys.length > 0) {
									const contextStr = Object.entries(rest)
										.filter(
											([key]) =>
												!["pid", "hostname", "levelValue", "time"].includes(
													key,
												),
										)
										.map(([key, value]) => {
											const serializedValue =
												typeof value === "object" && value !== null
													? JSON.stringify(value)
													: value;
											return `${key}=${serializedValue}`;
										})
										.join(" ");
									output += ` ${COLOR.DIM}(${contextStr})${COLOR.RESET}`;
								}

								console.log(output);
							} catch {
								process.stdout.write(chunk);
							}
						},
					}
				: undefined;

		this.logger = pino(
			{
				level: logLevel,

				// Server-side configuration
				...(typeof window === "undefined" && {
					formatters: usePrettyLogs
						? {
								level: (label) => ({ level: label }),
								bindings: () => ({}),
							}
						: {
								level: (label, number) => ({
									level: label,
									levelValue: number,
								}),
							},
				}),

				// Browser-side configuration
				browser: {
					write: (logObj) => {
						const {
							level,
							msg,
							group: logGroup,
							time,
							...rest
						} = logObj as Record<string, string | undefined>;

						const levelUppercased = (level || "info").toUpperCase();
						const timeFormatted = formatTime(new Date(time || Date.now()));
						const LEVEL_COLOR = LEVEL_COLORS[levelUppercased] || COLOR.WHITE;
						const GROUP_COLOR = getGroupColor(logGroup || "default");

						if (usePrettyLogs) {
							if (Object.keys(rest).length > 0) {
								console.log(
									`[${timeFormatted}] ${LEVEL_COLOR}${levelUppercased} ${GROUP_COLOR}[${logGroup}] ${msg} ${COLOR.WHITE}`,
									rest,
								);
							} else {
								console.log(
									`[${timeFormatted}] ${LEVEL_COLOR}${levelUppercased} ${GROUP_COLOR}[${logGroup}] ${msg} ${COLOR.WHITE}`,
								);
							}
						} else {
							console.log(
								`[${timeFormatted}] ${LEVEL_COLOR}${levelUppercased} ${GROUP_COLOR}[${logGroup}] ${msg} ${COLOR.WHITE}`,
								logObj,
							);
						}
					},
					formatters: {
						level: (label) => ({ level: label }),
					},
				},
			},
			destination,
		).child({ group });
	}

	private mergeWithRequestContext(obj: object | unknown): object {
		const requestContext = getFilteredRequestContext?.() || {};

		if (typeof obj !== "object" || obj === null) {
			return requestContext;
		}

		return { ...requestContext, ...obj };
	}

	public info<T extends object>(obj: T, msg?: string, ...args: unknown[]): void;
	public info(obj: unknown, msg?: string, ...args: unknown[]): void;
	public info(msg: string, ...args: unknown[]): void;
	public info(
		objOrMsg: object | unknown | string,
		msg?: string,
		...args: unknown[]
	): void {
		if (typeof objOrMsg === "string") {
			const contextObj = this.mergeWithRequestContext({});
			this.logger.info(contextObj, objOrMsg, msg, ...args);
		} else {
			const enrichedObj = this.mergeWithRequestContext(objOrMsg);
			this.logger.info(enrichedObj, msg, ...args);
		}
	}

	public warn<T extends object>(obj: T, msg?: string, ...args: unknown[]): void;
	public warn(obj: unknown, msg?: string, ...args: unknown[]): void;
	public warn(msg: string, ...args: unknown[]): void;
	public warn(
		objOrMsg: object | unknown | string,
		msg?: string,
		...args: unknown[]
	): void {
		if (typeof objOrMsg === "string") {
			const contextObj = this.mergeWithRequestContext({});
			this.logger.warn(contextObj, objOrMsg, msg, ...args);
		} else {
			const enrichedObj = this.mergeWithRequestContext(objOrMsg);
			this.logger.warn(enrichedObj, msg, ...args);
		}
	}

	public error<T extends object>(
		obj: T,
		msg?: string,
		...args: unknown[]
	): void;
	public error(obj: unknown, msg?: string, ...args: unknown[]): void;
	public error(msg: string, ...args: unknown[]): void;
	public error(
		objOrMsg: object | unknown | string,
		msg?: string,
		...args: unknown[]
	): void {
		if (typeof objOrMsg === "string") {
			const contextObj = this.mergeWithRequestContext({});
			this.logger.error(contextObj, objOrMsg, msg, ...args);
		} else {
			const enrichedObj = this.mergeWithRequestContext(objOrMsg);
			this.logger.error(enrichedObj, msg, ...args);
		}
	}

	public debug<T extends object>(
		obj: T,
		msg?: string,
		...args: unknown[]
	): void;
	public debug(obj: unknown, msg?: string, ...args: unknown[]): void;
	public debug(msg: string, ...args: unknown[]): void;
	public debug(
		objOrMsg: object | unknown | string,
		msg?: string,
		...args: unknown[]
	): void {
		if (typeof objOrMsg === "string") {
			const contextObj = this.mergeWithRequestContext({});
			this.logger.debug(contextObj, objOrMsg, msg, ...args);
		} else {
			const enrichedObj = this.mergeWithRequestContext(objOrMsg);
			this.logger.debug(enrichedObj, msg, ...args);
		}
	}

	public fatal<T extends object>(
		obj: T,
		msg?: string,
		...args: unknown[]
	): void;
	public fatal(obj: unknown, msg?: string, ...args: unknown[]): void;
	public fatal(msg: string, ...args: unknown[]): void;
	public fatal(
		objOrMsg: object | unknown | string,
		msg?: string,
		...args: unknown[]
	): void {
		if (typeof objOrMsg === "string") {
			const contextObj = this.mergeWithRequestContext({});
			this.logger.fatal(contextObj, objOrMsg, msg, ...args);
		} else {
			const enrichedObj = this.mergeWithRequestContext(objOrMsg);
			this.logger.fatal(enrichedObj, msg, ...args);
		}
	}

	public trace<T extends object>(
		obj: T,
		msg?: string,
		...args: unknown[]
	): void;
	public trace(obj: unknown, msg?: string, ...args: unknown[]): void;
	public trace(msg: string, ...args: unknown[]): void;
	public trace(
		objOrMsg: object | unknown | string,
		msg?: string,
		...args: unknown[]
	): void {
		if (typeof objOrMsg === "string") {
			const contextObj = this.mergeWithRequestContext({});
			this.logger.trace(contextObj, objOrMsg, msg, ...args);
		} else {
			const enrichedObj = this.mergeWithRequestContext(objOrMsg);
			this.logger.trace(enrichedObj, msg, ...args);
		}
	}
}
