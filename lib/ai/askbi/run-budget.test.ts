import { afterEach, describe, expect, it, vi } from "vitest";
import { isGroundingMiss, RunBudget } from "./run-budget";

// A controllable clock for deterministic decision-logic tests.
function clock(start = 0) {
	let t = start;
	return {
		now: () => t,
		advance: (ms: number) => {
			t += ms;
		},
	};
}

describe("RunBudget — step ceiling", () => {
	it("exhausts after maxSteps and records the cap hit", () => {
		const b = new RunBudget({ maxSteps: 2, now: () => 0 });
		expect(b.stepsExhausted()).toBe(false);
		b.recordStep();
		expect(b.stepsExhausted()).toBe(false);
		b.recordStep();
		expect(b.stepsExhausted()).toBe(true);
		expect(b.telemetry().capHits).toContain("steps");
		b.dispose();
	});
});

describe("RunBudget — SQL repair budget", () => {
	it("allows repair while budget remains, then stops", () => {
		const b = new RunBudget({ maxSqlAttempts: 2, now: () => 0 });
		expect(b.canRepair({ retryable: true })).toBe(true);
		b.recordSqlAttempt();
		expect(b.canRepair({ retryable: true })).toBe(true);
		b.recordSqlAttempt();
		expect(b.sqlAttemptsExhausted()).toBe(true);
		expect(b.canRepair({ retryable: true })).toBe(false);
		expect(b.telemetry().capHits).toContain("sql_attempts");
		b.dispose();
	});

	it("never repairs a non-retryable failure", () => {
		const b = new RunBudget({ maxSqlAttempts: 3, now: () => 0 });
		expect(b.canRepair({ retryable: false })).toBe(false);
		b.dispose();
	});
});

describe("RunBudget — wall-clock deadline (decision logic)", () => {
	it("reports timed out once the deadline passes and blocks repair", () => {
		const c = clock();
		const b = new RunBudget({ deadlineMs: 1000, now: c.now });
		expect(b.timedOut()).toBe(false);
		expect(b.canRepair({ retryable: true })).toBe(true);
		c.advance(1001);
		expect(b.timedOut()).toBe(true);
		expect(b.canRepair({ retryable: true })).toBe(false);
		expect(b.telemetry().capHits).toContain("deadline");
		b.dispose();
	});
});

describe("RunBudget — wall-clock deadline (enforced via AbortSignal)", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("aborts the signal when the deadline elapses", () => {
		vi.useFakeTimers();
		const b = new RunBudget({ deadlineMs: 1000 });
		expect(b.signal.aborted).toBe(false);
		vi.advanceTimersByTime(1001);
		expect(b.signal.aborted).toBe(true);
		expect(b.telemetry().capHits).toContain("deadline");
		b.dispose();
	});

	it("does not abort before the deadline, and dispose() cancels the timer", () => {
		vi.useFakeTimers();
		const b = new RunBudget({ deadlineMs: 1000 });
		vi.advanceTimersByTime(500);
		expect(b.signal.aborted).toBe(false);
		b.dispose();
		vi.advanceTimersByTime(1000);
		expect(b.signal.aborted).toBe(false); // timer was cleared
	});
});

describe("isGroundingMiss — fast-fail, don't spend repair budget", () => {
	it("is a miss when no catalog tables matched", () => {
		expect(isGroundingMiss(0)).toBe(true);
		expect(isGroundingMiss(1)).toBe(false);
		expect(isGroundingMiss(5)).toBe(false);
	});
});
