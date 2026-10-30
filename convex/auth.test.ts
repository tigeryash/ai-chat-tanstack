import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	RESPONSE_FLOOR_MS,
	SIGN_UP_RESPONSE,
} from "./lib/hideAccountExistence";
import { type ConvexTest, createConvexTest, signIn } from "./test.helpers";

// Made-up values. Never put a real Brevo key in a test.
const ENV = {
	SITE_URL: "http://localhost:3000",
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
	BREVO_API_KEY: "xkeysib-not-a-real-key",
	EMAIL_FROM_ADDRESS: "noreply@example.test",
};
const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";
// Longer than any floor, so a response that waited on Brevo would arrive after it. Queued emails start
// while the request waits out its floor, so Brevo may already have been called by the time it answers.
const BREVO_LATENCY_MS = 1_500;
// Both paths are padded to the same floor, so what's left is convex-test's own jitter.
const SAME_TIME_TOLERANCE_MS = 100;
// `Date.now()` inside the floor rounds to whole milliseconds; `performance.now()` here doesn't.
const CLOCK_SLACK_MS = 5;
const PASSWORD = "correct-horse-battery";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

interface SentEmail {
	to: string;
	subject: string;
	text: string;
}

// Brevo stand-in: records each email, then answers after BREVO_LATENCY_MS. Any other request fails.
function stubBrevo() {
	const sent: SentEmail[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			if (String(input) !== BREVO_SEND_URL)
				throw new Error("Unexpected request off the machine");
			const body = JSON.parse(String(init?.body));
			sent.push({
				to: body.to[0].email,
				subject: body.subject,
				text: body.textContent,
			});
			await new Promise((resolve) => setTimeout(resolve, BREVO_LATENCY_MS));
			return new Response(JSON.stringify({ messageId: "<id@brevo>" }), {
				status: 201,
			});
		}),
	);
	return sent;
}

function spyOnConsole() {
	return CONSOLE_METHODS.map((method) =>
		vi.spyOn(console, method).mockImplementation(() => {}),
	);
}

function loggedText(spies: ReturnType<typeof spyOnConsole>) {
	return spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join("\n");
}

// The verification or reset link in an email: a bearer token.
function linkIn(email: SentEmail) {
	const link = email.text.match(/https?:\/\/\S+/)?.[0];
	if (!link) throw new Error("The email has no link");
	return link;
}

// Through convex/http.ts, the way the browser reaches Better Auth.
async function post(t: ConvexTest, path: string, body: unknown) {
	const start = performance.now();
	const response = await t.fetch(`/api/auth${path}`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: ENV.SITE_URL },
		body: JSON.stringify(body),
	});
	return {
		status: response.status,
		body: await response.text(),
		ms: performance.now() - start,
	};
}

// A fresh convex-test instance loads the auth modules on its first request, about 85 ms that land before
// the floor starts counting and would skew whichever path is measured first. Better Auth's `/ok` is cheap.
async function warmUp(t: ConvexTest) {
	expect((await t.fetch("/api/auth/ok")).status).toBe(200);
}

describe("convex/auth.ts: responses don't reveal whether an account exists", () => {
	let consoleSpies: ReturnType<typeof spyOnConsole>;

	beforeEach(() => {
		for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
		consoleSpies = spyOnConsole();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("answers a reset request alike for a real account and an unknown address, then emails only the real one", async () => {
		const sent = stubBrevo();
		const t = createConvexTest();
		await signIn(t, "real", { withAppUser: false });
		await warmUp(t);

		const known = await post(t, "/request-password-reset", {
			email: "real@example.test",
		});
		const unknown = await post(t, "/request-password-reset", {
			email: "nobody@example.test",
		});

		expect(known.status).toBe(200);
		expect(unknown.status).toBe(known.status);
		expect(unknown.body).toBe(known.body);
		const floor = RESPONSE_FLOOR_MS["/request-password-reset"];
		expect(known.ms).toBeGreaterThanOrEqual(floor - CLOCK_SLACK_MS);
		expect(unknown.ms).toBeGreaterThanOrEqual(floor - CLOCK_SLACK_MS);
		expect(known.ms).toBeLessThan(BREVO_LATENCY_MS);
		expect(Math.abs(known.ms - unknown.ms)).toBeLessThan(
			SAME_TIME_TOLERANCE_MS,
		);

		await t.finishAllScheduledFunctions(() => {});

		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			to: "real@example.test",
			subject: "Reset your password",
		});
		expect(linkIn(sent[0])).toContain(
			`${ENV.SITE_URL}/api/auth/reset-password/`,
		);
		expect(loggedText(consoleSpies)).not.toContain(linkIn(sent[0]));
	}, 10_000);

	it("answers sign-up alike for a new and an existing address, then emails only the new one", async () => {
		const sent = stubBrevo();
		const t = createConvexTest();
		await signIn(t, "taken", { withAppUser: false });
		await warmUp(t);

		const fresh = await post(t, "/sign-up/email", {
			email: "new@example.test",
			password: PASSWORD,
			name: "New",
		});
		const existing = await post(t, "/sign-up/email", {
			email: "taken@example.test",
			password: PASSWORD,
			name: "Taken",
		});

		expect(fresh.status).toBe(200);
		expect(existing.status).toBe(fresh.status);
		expect(JSON.parse(fresh.body)).toEqual(SIGN_UP_RESPONSE);
		expect(existing.body).toBe(fresh.body);
		const floor = RESPONSE_FLOOR_MS["/sign-up/email"];
		expect(fresh.ms).toBeGreaterThanOrEqual(floor - CLOCK_SLACK_MS);
		expect(existing.ms).toBeGreaterThanOrEqual(floor - CLOCK_SLACK_MS);
		expect(fresh.ms).toBeLessThan(BREVO_LATENCY_MS);
		expect(Math.abs(fresh.ms - existing.ms)).toBeLessThan(
			SAME_TIME_TOLERANCE_MS,
		);

		await t.finishAllScheduledFunctions(() => {});

		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({
			to: "new@example.test",
			subject: "Verify your email address",
		});
		expect(linkIn(sent[0])).toContain(
			`${ENV.SITE_URL}/api/auth/verify-email?token=`,
		);
		expect(loggedText(consoleSpies)).not.toContain(linkIn(sent[0]));
	}, 10_000);

	it("still refuses reset and sign-up with a 503, for every address, when email isn't configured", async () => {
		vi.stubEnv("BREVO_API_KEY", undefined);
		const sent = stubBrevo();
		const t = createConvexTest();
		await signIn(t, "real", { withAppUser: false });

		const known = await post(t, "/request-password-reset", {
			email: "real@example.test",
		});
		const unknown = await post(t, "/request-password-reset", {
			email: "nobody@example.test",
		});
		const signUp = await post(t, "/sign-up/email", {
			email: "new@example.test",
			password: PASSWORD,
			name: "New",
		});

		expect(known.status).toBe(503);
		expect(unknown).toMatchObject({ status: 503, body: known.body });
		expect(signUp.status).toBe(503);
		await t.finishAllScheduledFunctions(() => {});
		expect(sent).toEqual([]);
		expect(loggedText(consoleSpies)).toContain("BREVO_API_KEY");
	});
});
