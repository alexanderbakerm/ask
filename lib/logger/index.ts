import { LoggerFactory } from "./factory";

export const logger = LoggerFactory.getLogger();

export type { Logger as LoggerType } from "./logger";
