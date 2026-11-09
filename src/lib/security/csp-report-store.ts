import { logWarn } from "@/lib/log";
import type { CspViolation } from "@/lib/security/csp-report";

// Sends `/api/csp-report`'s reduced violations to Convex (`convex/cspReports.ts`), which keeps a count
// per directive, blocked origin and route for 30 days: Vercel Hobby keeps our logs for only an hour.
// Server only. CSP_REPORT_SECRET is the shared secret Convex's `/csp-report` HTTP action checks; when
// it's unset (local dev, e2e and preview builds) nothing is sent.

const SECRET_ENV = "CSP_REPORT_SECRET";
const TIMEOUT_MS = 2000;

interface StoreEnv {
	siteUrl: string | undefined;
	secret: string | undefined;
}

function readEnv(): StoreEnv {
	return {
		siteUrl: process.env.VITE_CONVEX_SITE_URL,
		secret: process.env[SECRET_ENV],
	};
}

/** Never throws: a failed store only logs its status, and the report is still in the `[csp]` log. */
export async function storeCspViolations(
	violations: readonly CspViolation[],
	env: StoreEnv = readEnv(),
	fetchImpl: typeof fetch = fetch,
): Promise<void> {
	if (violations.length === 0 || !env.siteUrl || !env.secret) return;
	try {
		const response = await fetchImpl(new URL("/csp-report", env.siteUrl), {
			method: "POST",
			headers: {
				authorization: `Bearer ${env.secret}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				violations: violations.map((violation) => ({
					disposition: violation.disposition,
					directive: violation.directive,
					blockedOrigin: violation.blocked,
					page: violation.page,
				})),
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) {
			logWarn(`[csp] storing reports failed with status ${response.status}`);
		}
	} catch (error) {
		logWarn(
			`[csp] storing reports failed: ${error instanceof Error ? error.name : "unknown error"}`,
		);
	}
}
