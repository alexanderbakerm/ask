import { AsyncLocalStorage } from "node:async_hooks";

const isTestEnv =
	typeof process !== "undefined" && process.env?.NODE_ENV === "test";
if (typeof window !== "undefined" && !isTestEnv) {
	throw new Error("Context module should not be imported on the client-side");
}

export interface RequestContext {
	requestId?: string;
	userId?: string;
	userEmail?: string;
	userRole?: string;
	organizationId?: string;
	userAgent?: string;
	ip?: string;
	endpoint?: string;
	method?: string;
	trpcProcedure?: string;
	trpcType?: string;
	webhookType?: string;
	sessionId?: string;
	[key: string]: unknown;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
	return requestContextStorage.getStore() ?? {};
}

export function setRequestContext(context: RequestContext): void {
	const currentContext = getRequestContext();
	const mergedContext = { ...currentContext, ...context };

	const store = requestContextStorage.getStore();
	if (store) {
		Object.assign(store, mergedContext);
	}
}

export function addRequestContext(
	additionalContext: Partial<RequestContext>,
): void {
	const currentContext = getRequestContext();
	const mergedContext = { ...currentContext, ...additionalContext };

	const store = requestContextStorage.getStore();
	if (store) {
		Object.assign(store, mergedContext);
	}
}

export function runWithRequestContext<T>(
	context: RequestContext,
	fn: () => T,
): T {
	return requestContextStorage.run(context, fn);
}

export function runWithAdditionalContext<T>(
	additionalContext: Partial<RequestContext>,
	fn: () => T,
): T {
	const currentContext = getRequestContext();
	const mergedContext = { ...currentContext, ...additionalContext };
	return requestContextStorage.run(mergedContext, fn);
}

export function filterTruthy(
	obj: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(obj).filter(
			([_, value]) => value !== null && value !== undefined,
		),
	);
}

export function getFilteredRequestContext(): Record<string, unknown> {
	return filterTruthy(getRequestContext());
}
