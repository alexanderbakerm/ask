import { describe, expect, it } from "vitest";
import { capitalize, getInitials } from "@/lib/utils";

describe("capitalize", () => {
	it("capitalizes the first letter of a word", () => {
		expect(capitalize("hello")).toBe("Hello");
	});

	it("returns empty string if input is empty", () => {
		expect(capitalize("")).toBe("");
	});

	it("capitalizes a single character", () => {
		expect(capitalize("a")).toBe("A");
	});

	it("returns already capitalized string unchanged", () => {
		expect(capitalize("Hello")).toBe("Hello");
	});

	it("handles strings with spaces", () => {
		expect(capitalize(" hello")).toBe(" hello");
	});
});

describe("getInitials", () => {
	it("returns initials for a two-word name", () => {
		expect(getInitials("John Doe")).toBe("JD");
	});

	it("returns initial for a single-word name", () => {
		expect(getInitials("Alice")).toBe("A");
	});

	it("returns initials for names with extra spaces", () => {
		expect(getInitials("  John   Doe  ")).toBe("JD");
	});

	it("returns empty string for empty input", () => {
		expect(getInitials("")).toBe("");
	});

	it("returns initials for three-word name (first two only)", () => {
		expect(getInitials("John Michael Doe")).toBe("JM");
	});

	it("handles lowercase names", () => {
		expect(getInitials("jane smith")).toBe("JS");
	});
});
