import { Logger } from "@/lib/logger/logger";

export class LoggerFactory {
	private static instances: Map<string, Logger> = new Map();
	private static defaultInstance: Logger;

	private constructor() {
		// Private constructor to prevent direct instantiation
	}

	public static getLogger(group?: string): Logger {
		const key = group || "default"; // Use 'default' if no group is provided

		if (key === "default" && !LoggerFactory.defaultInstance) {
			LoggerFactory.defaultInstance = new Logger(key);
			LoggerFactory.instances.set(key, LoggerFactory.defaultInstance);
		} else if (key !== "default" && !LoggerFactory.instances.has(key)) {
			LoggerFactory.instances.set(key, new Logger(key));
		}

		return LoggerFactory.instances.get(key)!;
	}

	public static createNew(group?: string): Logger {
		return new Logger(group);
	}
}
