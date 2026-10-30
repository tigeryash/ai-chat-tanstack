import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	EmailNotConfiguredError,
	missingEmailEnv,
	sendEmail,
	sendPasswordChangedNotice,
} from "./email";

// Made-up values. Never put a real Brevo key in a test.
const FAKE_KEY = "xkeysib-not-a-real-key";
const FROM_ADDRESS = "noreply@example.test";
const FROM_NAME = "Example App";
const RECIPIENT = "someone@example.test";
const LINK = "https://example.test/verify-email?token=secret-token-123";
const EMAIL = {
	to: RECIPIENT,
	subject: "Verify your email address",
	text: `Click the link to verify your email: ${LINK}`,
};

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

function spyOnConsole() {
	return CONSOLE_METHODS.map((method) =>
		vi.spyOn(console, method).mockImplementation(() => {}),
	);
}

// Everything written to the console and the thrown error, so a test can check none of it leaks content.
function loggedText(spies: ReturnType<typeof spyOnConsole>) {
	return spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join("\n");
}

function configureEmail() {
	vi.stubEnv("BREVO_API_KEY", FAKE_KEY);
	vi.stubEnv("EMAIL_FROM_ADDRESS", FROM_ADDRESS);
	vi.stubEnv("EMAIL_FROM_NAME", FROM_NAME);
}

describe("convex/email.ts sendEmail", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	let consoleSpies: ReturnType<typeof spyOnConsole>;

	beforeEach(() => {
		vi.stubEnv("BREVO_API_KEY", undefined);
		vi.stubEnv("EMAIL_FROM_ADDRESS", undefined);
		vi.stubEnv("EMAIL_FROM_NAME", undefined);
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		consoleSpies = spyOnConsole();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("throws without BREVO_API_KEY and logs nothing about the email", async () => {
		vi.stubEnv("EMAIL_FROM_ADDRESS", FROM_ADDRESS);

		const error = await sendEmail(EMAIL).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(EmailNotConfiguredError);
		expect(String(error)).toContain("BREVO_API_KEY");
		expect(fetchMock).not.toHaveBeenCalled();
		const leaked = `${loggedText(consoleSpies)}\n${String(error)}`;
		expect(leaked).not.toContain(LINK);
		expect(leaked).not.toContain("secret-token-123");
		expect(leaked).not.toContain(RECIPIENT);
	});

	it("throws without EMAIL_FROM_ADDRESS, naming the variable but not the key", async () => {
		vi.stubEnv("BREVO_API_KEY", FAKE_KEY);

		const error = await sendEmail(EMAIL).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(EmailNotConfiguredError);
		expect(String(error)).toContain("EMAIL_FROM_ADDRESS");
		expect(String(error)).not.toContain(FAKE_KEY);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("posts to Brevo with the configured sender and the recipient", async () => {
		configureEmail();
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ messageId: "<id@brevo>" }), {
				status: 201,
			}),
		);

		await sendEmail(EMAIL);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://api.brevo.com/v3/smtp/email");
		expect(init.method).toBe("POST");
		expect(init.headers).toMatchObject({ "api-key": FAKE_KEY });
		expect(JSON.parse(String(init.body))).toMatchObject({
			sender: { name: FROM_NAME, email: FROM_ADDRESS },
			to: [{ email: RECIPIENT }],
			subject: EMAIL.subject,
			textContent: EMAIL.text,
		});
		expect(loggedText(consoleSpies)).toBe("");
	});

	it("leaves the sender name out when EMAIL_FROM_NAME is unset", async () => {
		vi.stubEnv("BREVO_API_KEY", FAKE_KEY);
		vi.stubEnv("EMAIL_FROM_ADDRESS", FROM_ADDRESS);
		fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));

		await sendEmail(EMAIL);

		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(JSON.parse(String(init.body)).sender).toEqual({
			email: FROM_ADDRESS,
		});
	});

	it("reports a Brevo rejection by status and code only", async () => {
		configureEmail();
		// Brevo's message can quote the request, so it must not reach the error or the logs.
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					code: "invalid_parameter",
					message: `email ${RECIPIENT} is not valid, link ${LINK}`,
				}),
				{ status: 400 },
			),
		);

		const error = await sendEmail(EMAIL).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(Error);
		expect(String(error)).toContain("400");
		expect(String(error)).toContain("invalid_parameter");
		const leaked = `${loggedText(consoleSpies)}\n${String(error)}`;
		expect(leaked).not.toContain(RECIPIENT);
		expect(leaked).not.toContain(LINK);
		expect(leaked).not.toContain(FAKE_KEY);
	});

	it("drops a Brevo error code that isn't a plain identifier", async () => {
		configureEmail();
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ code: `bad ${RECIPIENT}` }), {
				status: 400,
			}),
		);

		const error = await sendEmail(EMAIL).catch((e: unknown) => e);

		expect(String(error)).toContain("400");
		expect(String(error)).not.toContain(RECIPIENT);
	});
});

describe("convex/email.ts sendPasswordChangedNotice", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	let consoleSpies: ReturnType<typeof spyOnConsole>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		consoleSpies = spyOnConsole();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("resolves when Brevo rejects the notice, logging the cause without the address", async () => {
		configureEmail();
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({ code: "unauthorized", message: `bad ${RECIPIENT}` }),
				{
					status: 401,
				},
			),
		);

		await expect(sendPasswordChangedNotice(RECIPIENT)).resolves.toBeUndefined();

		const logged = loggedText(consoleSpies);
		expect(logged).toContain("401");
		expect(logged).not.toContain(RECIPIENT);
	});

	it("resolves when email isn't configured", async () => {
		vi.stubEnv("BREVO_API_KEY", undefined);
		vi.stubEnv("EMAIL_FROM_ADDRESS", undefined);

		await expect(sendPasswordChangedNotice(RECIPIENT)).resolves.toBeUndefined();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(loggedText(consoleSpies)).not.toContain(RECIPIENT);
	});

	it("sends the notice when email works", async () => {
		configureEmail();
		fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));

		await sendPasswordChangedNotice(RECIPIENT);

		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(JSON.parse(String(init.body)).to).toEqual([{ email: RECIPIENT }]);
		expect(loggedText(consoleSpies)).toBe("");
	});
});

describe("convex/email.ts missingEmailEnv", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("names each missing variable", () => {
		vi.stubEnv("BREVO_API_KEY", undefined);
		vi.stubEnv("EMAIL_FROM_ADDRESS", undefined);
		expect(missingEmailEnv()).toEqual(["BREVO_API_KEY", "EMAIL_FROM_ADDRESS"]);
	});

	it("is empty when the key and sender address are set", () => {
		vi.stubEnv("BREVO_API_KEY", FAKE_KEY);
		vi.stubEnv("EMAIL_FROM_ADDRESS", FROM_ADDRESS);
		vi.stubEnv("EMAIL_FROM_NAME", undefined);
		expect(missingEmailEnv()).toEqual([]);
	});
});
