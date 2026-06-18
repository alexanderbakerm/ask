/**
 * Per-run guardrails for the AskBI agent: a hard step ceiling, a bounded SQL
 * repair budget, and an ENFORCED wall-clock deadline.
 *
 * The deadline is not merely tracked — it owns an AbortController whose signal
 * is passed to the model and DB calls, and it is also checked between steps. A
 * deadline that's only recorded protects nothing; this one aborts in-flight
 * work and fails closed (same discipline as the validator-throw case).
 *
 * Cap hits are recorded so the agent can emit telemetry — the signal that later
 * tells us whether grounding or the model tier needs tuning. (Reminder for that
 * day: if repair rates are high, fix `retrieve-catalog` grounding first, then
 * drop the model tier — a good catalog slice lets a cheap model write correct
 * SQL.)
 *
 * The decision logic is pure (injectable clock) and unit-tested; the
 * AbortController is the runtime enforcement.
 */

export const DEFAULT_MAX_STEPS = 8;
export const DEFAULT_MAX_SQL_ATTEMPTS = 3;
export const DEFAULT_DEADLINE_MS = 45_000;

export type BudgetCap = "steps" | "sql_attempts" | "deadline";

export interface RunBudgetOptions {
	maxSteps?: number;
	maxSqlAttempts?: number;
	deadlineMs?: number;
	/** Injectable clock for deterministic tests. Defaults to `Date.now`. */
	now?: () => number;
}

export interface RunBudgetTelemetry {
	stepsUsed: number;
	sqlAttemptsUsed: number;
	elapsedMs: number;
	timedOut: boolean;
	capHits: BudgetCap[];
}

export class RunBudget {
	readonly maxSteps: number;
	readonly maxSqlAttempts: number;
	readonly deadlineMs: number;

	private readonly now: () => number;
	private readonly startedAt: number;
	private readonly controller = new AbortController();
	private readonly capHits = new Set<BudgetCap>();
	private timer: ReturnType<typeof setTimeout> | undefined;
	private stepsUsed = 0;
	private sqlAttemptsUsed = 0;

	constructor(options: RunBudgetOptions = {}) {
		this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
		this.maxSqlAttempts = options.maxSqlAttempts ?? DEFAULT_MAX_SQL_ATTEMPTS;
		this.deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
		this.now = options.now ?? (() => Date.now());
		this.startedAt = this.now();

		if (Number.isFinite(this.deadlineMs) && this.deadlineMs > 0) {
			this.timer = setTimeout(() => this.tripDeadline(), this.deadlineMs);
		}
	}

	/** Pass to `streamText({ abortSignal })` and through to the DB calls. */
	get signal(): AbortSignal {
		return this.controller.signal;
	}

	private tripDeadline(): void {
		this.capHits.add("deadline");
		if (!this.controller.signal.aborted) {
			this.controller.abort(new Error("AskBI run exceeded its time budget"));
		}
	}

	elapsedMs(): number {
		return this.now() - this.startedAt;
	}

	timedOut(): boolean {
		const out = this.elapsedMs() >= this.deadlineMs;
		if (out) {
			this.capHits.add("deadline");
		}
		return out;
	}

	recordStep(): void {
		this.stepsUsed += 1;
		if (this.stepsUsed >= this.maxSteps) {
			this.capHits.add("steps");
		}
	}

	stepsExhausted(): boolean {
		return this.stepsUsed >= this.maxSteps;
	}

	recordSqlAttempt(): void {
		this.sqlAttemptsUsed += 1;
		if (this.sqlAttemptsUsed >= this.maxSqlAttempts) {
			this.capHits.add("sql_attempts");
		}
	}

	sqlAttemptsExhausted(): boolean {
		return this.sqlAttemptsUsed >= this.maxSqlAttempts;
	}

	/**
	 * Whether the agent should attempt a SQL repair after a failure. Only when
	 * the failure is retryable (execute.ts already encodes bad-column/syntax as
	 * retryable and `internal` as not), the attempt budget remains, and the run
	 * has not timed out. Note a grounding miss never reaches here — see
	 * {@link isGroundingMiss} — so it never consumes this budget.
	 */
	canRepair(failure: { retryable: boolean }): boolean {
		if (!failure.retryable) return false;
		if (this.sqlAttemptsExhausted()) return false;
		if (this.timedOut()) return false;
		return true;
	}

	telemetry(): RunBudgetTelemetry {
		return {
			stepsUsed: this.stepsUsed,
			sqlAttemptsUsed: this.sqlAttemptsUsed,
			elapsedMs: this.elapsedMs(),
			timedOut: this.elapsedMs() >= this.deadlineMs,
			capHits: [...this.capHits],
		};
	}

	/** Clear the deadline timer. Always call when the run ends. */
	dispose(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
	}
}

/**
 * A question that maps to no catalog tables is a GROUNDING failure, not a
 * fixable-SQL failure. It must short-circuit to an honest "couldn't find data"
 * without ever attempting SQL — so it never spends the repair budget.
 */
export function isGroundingMiss(matchedTableCount: number): boolean {
	return matchedTableCount <= 0;
}
