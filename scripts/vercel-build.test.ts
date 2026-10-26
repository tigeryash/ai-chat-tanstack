import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("./vercel-build.sh", import.meta.url));
const VITE_BUILD =
	"node --max-old-space-size=8192 ./node_modules/vite/bin/vite.js build";
// A made-up key in the production format. Never put a real deploy key in a test.
const FAKE_PROD_KEY = "prod:test-deployment-123|not-a-real-key";

// Runs the script in --dry-run mode with only the env given here, so a CONVEX_DEPLOY_KEY in the
// developer's shell can't leak in.
function dryRun(env: Record<string, string>) {
	const result = spawnSync("sh", [SCRIPT, "--dry-run"], {
		env: { PATH: process.env.PATH ?? "", ...env },
		encoding: "utf8",
	});
	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

describe("scripts/vercel-build.sh", () => {
	it("deploys Convex and builds against it in production", () => {
		const { status, stdout } = dryRun({
			VERCEL_ENV: "production",
			CONVEX_DEPLOY_KEY: FAKE_PROD_KEY,
		});

		expect(status).toBe(0);
		expect(stdout).toContain(
			`npx convex deploy --cmd '${VITE_BUILD}' --cmd-url-env-var-name VITE_CONVEX_URL`,
		);
		expect(stdout).not.toContain(FAKE_PROD_KEY);
	});

	it.each(["preview", "development", ""])(
		"runs only the Vite build when VERCEL_ENV is %j",
		(vercelEnv) => {
			// Even with a key present, a non-production build must not deploy.
			const { status, stdout } = dryRun({
				VERCEL_ENV: vercelEnv,
				CONVEX_DEPLOY_KEY: FAKE_PROD_KEY,
			});

			expect(status).toBe(0);
			expect(stdout).toContain(VITE_BUILD);
			expect(stdout).not.toContain("convex deploy");
		},
	);

	it("fails a production build without a deploy key", () => {
		const { status, stdout, stderr } = dryRun({ VERCEL_ENV: "production" });

		expect(status).toBe(1);
		expect(stderr).toContain("CONVEX_DEPLOY_KEY is not set");
		expect(stdout).not.toContain(VITE_BUILD);
	});

	it.each(["dev:my-dev-123|x", "preview:team:project|x"])(
		"fails a production build with a non-production key",
		(key) => {
			const { status, stdout, stderr } = dryRun({
				VERCEL_ENV: "production",
				CONVEX_DEPLOY_KEY: key,
			});

			expect(status).toBe(1);
			expect(stderr).toContain("dev or preview key");
			expect(stderr).not.toContain(key);
			expect(stdout).not.toContain("convex deploy");
		},
	);
});
