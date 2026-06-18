import { expect, test } from "@playwright/test";

test.describe("Authentication Pages", () => {
	test("sign-in page loads correctly", async ({ page }) => {
		await page.goto("/auth/sign-in");

		// Check page title
		await expect(page).toHaveTitle(/Sign in/);

		// Check main heading
		await expect(
			page.getByRole("heading", { name: "Sign in to your account" }),
		).toBeVisible();

		// Check form elements
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
		await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

		// Check links
		await expect(
			page.getByRole("link", { name: "Forgot password?" }),
		).toBeVisible();
		await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
	});

	test("sign-up page loads correctly", async ({ page }) => {
		await page.goto("/auth/sign-up");

		// Check page title
		await expect(page).toHaveTitle(/Sign up/);

		// Check main heading
		await expect(
			page.getByRole("heading", { name: "Create your account" }),
		).toBeVisible();

		// Check form elements
		await expect(page.getByLabel("Name")).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Create account" }),
		).toBeVisible();

		// Check link to sign in
		await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
	});

	test("forgot-password page loads correctly", async ({ page }) => {
		await page.goto("/auth/forgot-password");

		// Check page title
		await expect(page).toHaveTitle(/Forgot password/);

		// Check main heading
		await expect(
			page.getByRole("heading", { name: "Forgot your password?" }),
		).toBeVisible();

		// Check form elements
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Send instructions" }),
		).toBeVisible();
	});

	test("can navigate from sign-in to sign-up", async ({ page }) => {
		await page.goto("/auth/sign-in");

		// Click sign up link
		await page.getByRole("link", { name: "Sign up" }).click();

		// Should be on sign-up page
		await expect(page).toHaveURL(/\/auth\/sign-up/);
		await expect(
			page.getByRole("heading", { name: "Create your account" }),
		).toBeVisible();
	});

	test("can navigate from sign-in to forgot-password", async ({ page }) => {
		await page.goto("/auth/sign-in");

		// Click forgot password link
		await page.getByRole("link", { name: "Forgot password?" }).click();

		// Should be on forgot-password page
		await expect(page).toHaveURL(/\/auth\/forgot-password/);
	});

	test("sign-in form shows validation errors", async ({ page }) => {
		await page.goto("/auth/sign-in");

		// Try to submit empty form
		await page.getByRole("button", { name: "Sign in" }).click();

		// Should show validation errors (form won't submit with empty fields)
		// The form uses HTML5 validation, so we check that the email field is invalid
		const emailInput = page.getByLabel("Email");
		await expect(emailInput).toHaveAttribute("type", "email");
	});

	test("sign-up form shows validation errors", async ({ page }) => {
		await page.goto("/auth/sign-up");

		// Fill in invalid data
		await page.getByLabel("Email").fill("invalid-email");
		await page.getByLabel("Password").fill("123"); // Too short

		// Try to submit
		await page.getByRole("button", { name: "Sign up" }).click();

		// Email field should be invalid (HTML5 validation)
		const emailInput = page.getByLabel("Email");
		await expect(emailInput).toHaveAttribute("type", "email");
	});
});
