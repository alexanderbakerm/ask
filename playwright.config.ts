import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const isCI = !!process.env.CI;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	workers: isCI ? 1 : undefined,
	reporter: [["html"]],
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
		video: {
			mode: "retain-on-failure",
			size: { width: 640, height: 480 },
		},
	},
	projects: [
		{ name: "setup", testMatch: /.*\.setup\.ts/ },
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],
	webServer: {
		command: "npm run build && npm run start",
		url: "http://localhost:3000",
		reuseExistingServer: !isCI,
		stdout: "pipe",
		timeout: 180 * 1000,
	},
});
