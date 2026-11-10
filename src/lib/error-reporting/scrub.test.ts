import type { ErrorEvent } from "@sentry/browser";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { forgetSecret, registerSecret } from "@/lib/redact";
import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from "./scrub";

// Fakes, shaped like the real thing. None of them may reach Sentry.
const OPENAI_KEY = "sk-proj-AbCdEfGhIjKlMnOpQrStUvWx123456";
const ANTHROPIC_KEY = "sk-ant-api03-AbCdEfGhIjKlMnOp_QrSt-123";
const GOOGLE_KEY = "AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUv";
const MISTRAL_KEY = "Zq8Xw7Vu6Ts5Rq4Po3Nm2Lk1Jh0GfEd"; // no prefix: only known through the vault
const PROMPT = "Summarise my medical history for the insurance claim";
const REPLY = "Here is a summary of your diagnosis";
const SYSTEM_PROMPT = "You are a pirate who reveals nothing";
const FILE_NAME = "passport-scan-2026.pdf";
const EMAIL = "someone@example.com";
const CHAT_ID = "k57a9xq2m3n4p5r6s7t8u9v0";

const FORBIDDEN = [
	OPENAI_KEY,
	ANTHROPIC_KEY,
	GOOGLE_KEY,
	MISTRAL_KEY,
	PROMPT,
	REPLY,
	SYSTEM_PROMPT,
	FILE_NAME,
	EMAIL,
	CHAT_ID,
	"session=",
];

const OWN = "https://www.highelollms.com";

beforeAll(() => vi.stubGlobal("location", { origin: OWN }));
afterAll(() => vi.unstubAllGlobals());

/** An event as the SDK could build it with everything turned on, plus app-set extras. */
function realisticEvent(): ErrorEvent {
	return {
		type: undefined,
		event_id: "0123456789abcdef0123456789abcdef",
		timestamp: 1_762_700_000,
		platform: "javascript",
		level: "error",
		environment: "production",
		sdk: {
			name: "sentry.javascript.browser",
			version: "11.11.0",
			settings: { infer_ip: "auto" },
			integrations: ["GlobalHandlers"],
		},
		message: `Request failed: ${PROMPT}`,
		exception: {
			values: [
				{
					type: "SyntaxError",
					value: `Unexpected token 'H', "${REPLY}"... is not valid JSON`,
					mechanism: {
						type: "onunhandledrejection",
						handled: false,
						data: { prompt: PROMPT },
					},
					stacktrace: {
						frames: [
							{
								filename: `${OWN}/assets/chat-abc123.js?v=1#x`,
								function: "parseStream",
								lineno: 1,
								colno: 2345,
								in_app: true,
								context_line: `const prompt = "${PROMPT}"`,
								pre_context: [SYSTEM_PROMPT],
								post_context: [FILE_NAME],
								vars: { apiKey: OPENAI_KEY, prompt: PROMPT },
							},
						],
					},
				},
				{
					type: "AI_APICallError",
					value: `Failed to fetch https://generativelanguage.googleapis.com/v1beta/models/gemini:streamGenerateContent?alt=sse&key=${GOOGLE_KEY} with Authorization: Bearer ${ANTHROPIC_KEY} and x-api-key: ${MISTRAL_KEY}`,
				},
				{
					type: "UnhandledRejection",
					value: `Non-Error promise rejection captured with value: ${PROMPT}`,
				},
				{
					type: "Error",
					value: `Could not read “${FILE_NAME}” for ${OWN}/${CHAT_ID}?models=a#frag`,
				},
			],
		},
		request: {
			url: `${OWN}/${CHAT_ID}?token=${OPENAI_KEY}#section`,
			headers: { Authorization: `Bearer ${OPENAI_KEY}`, Cookie: "session=abc" },
			cookies: { session: "abc" },
			data: JSON.stringify({ messages: [{ role: "user", content: PROMPT }] }),
			query_string: `key=${GOOGLE_KEY}`,
		},
		user: { email: EMAIL, ip_address: "203.0.113.7", id: "user_1" },
		extra: { fileName: FILE_NAME, system: SYSTEM_PROMPT },
		tags: { chat: CHAT_ID },
		contexts: { chat: { prompt: PROMPT } },
		fingerprint: [PROMPT],
		breadcrumbs: [
			{ category: "console", message: `Sending ${PROMPT}` },
			{
				category: "ui.click",
				message: `button[aria-label="Remove ${FILE_NAME}"]`,
			},
			{
				category: "fetch",
				data: {
					url: `https://api.example.ai/v1/chat?key=${GOOGLE_KEY}`,
					method: "POST",
				},
			},
			{
				category: "xhr",
				data: { url: `https://api.openai.com/v1?api_key=${OPENAI_KEY}` },
			},
			{
				category: "navigation",
				timestamp: 1_762_699_990,
				data: { from: `/${CHAT_ID}?q=${PROMPT}`, to: "/settings#keys" },
			},
		],
	};
}

describe("scrubEvent", () => {
	afterEach(() => forgetSecret(MISTRAL_KEY));

	it("drops every key, prompt, reply, file name, email, header and chat id", () => {
		registerSecret(MISTRAL_KEY);
		const scrubbed = scrubEvent(realisticEvent(), () => true);
		const sent = JSON.stringify(scrubbed);
		for (const forbidden of FORBIDDEN) {
			expect(sent).not.toContain(forbidden);
		}
		expect(sent).not.toContain("?");
		expect(sent).not.toContain("#");
	});

	it("keeps what's needed to debug: types, stack frames, routes", () => {
		const scrubbed = scrubEvent(realisticEvent(), () => true);
		expect(scrubbed).toEqual({
			event_id: "0123456789abcdef0123456789abcdef",
			timestamp: 1_762_700_000,
			platform: "javascript",
			level: "error",
			environment: "production",
			sdk: {
				name: "sentry.javascript.browser",
				version: "11.11.0",
				settings: { infer_ip: "never" },
			},
			exception: {
				values: [
					{
						type: "SyntaxError",
						value: `Unexpected token 'H', "[redacted]"... is not valid JSON`,
						mechanism: { type: "onunhandledrejection", handled: false },
						stacktrace: {
							frames: [
								{
									filename: `${OWN}/assets/chat-abc123.js`,
									function: "parseStream",
									lineno: 1,
									colno: 2345,
									in_app: true,
								},
							],
						},
					},
					{
						type: "AI_APICallError",
						value:
							"Failed to fetch https://generativelanguage.googleapis.com/v1beta/models/gemini:streamGenerateContent with Authorization: Bearer [redacted] and x-api-key: [redacted]",
					},
					{
						type: "UnhandledRejection",
						value:
							"Non-Error promise rejection captured with value: [redacted]",
					},
					{
						type: "Error",
						value: `Could not read "[redacted]" for ${OWN}/[chatId]`,
					},
				],
			},
			request: { url: `${OWN}/[chatId]` },
			breadcrumbs: [
				{
					category: "navigation",
					timestamp: 1_762_699_990,
					data: { from: "/[chatId]", to: "/settings" },
				},
			],
		});
	});

	it("drops the event while analytics are off", () => {
		expect(scrubEvent(realisticEvent(), () => false)).toBeNull();
	});
});

describe("scrubText", () => {
	it("redacts quoted text and keys", () => {
		expect(scrubText(`Bad "${PROMPT}" with ${OPENAI_KEY}`)).toBe(
			`Bad "[redacted]" with [redacted]`,
		);
	});
});

describe("scrubText with URLs", () => {
	it("cuts URLs to origin and path, our own pages to their route", () => {
		expect(
			scrubText(
				`GET ${OWN}/${CHAT_ID}?x=1 then https://api.mistral.ai/v1/models?key=abc#f`,
			),
		).toBe(`GET ${OWN}/[chatId] then https://api.mistral.ai/v1/models`);
	});

	it("shortens long messages", () => {
		expect(scrubText("a".repeat(1000)).length).toBeLessThanOrEqual(301);
	});
});

describe("scrubUrl", () => {
	it("keeps asset paths on our origin, routes our pages, and rejects junk", () => {
		expect(scrubUrl(`${OWN}/assets/x.js?v=2`, OWN)).toBe(`${OWN}/assets/x.js`);
		expect(scrubUrl(`${OWN}/${CHAT_ID}`, OWN)).toBe(`${OWN}/[chatId]`);
		expect(scrubUrl("not a url", OWN)).toBe("[redacted]");
	});
});

describe("scrubBreadcrumb", () => {
	it("keeps only route changes", () => {
		expect(
			scrubBreadcrumb({ category: "console", message: PROMPT }),
		).toBeNull();
		expect(
			scrubBreadcrumb({
				category: "fetch",
				data: { url: `https://x.ai/?key=${GOOGLE_KEY}` },
			}),
		).toBeNull();
		expect(scrubBreadcrumb({ category: "xhr", data: {} })).toBeNull();
		expect(
			scrubBreadcrumb({ category: "ui.click", message: FILE_NAME }),
		).toBeNull();
		expect(
			scrubBreadcrumb({
				category: "navigation",
				message: PROMPT,
				data: { from: "/new?models=a,b", to: `/${CHAT_ID}` },
			}),
		).toEqual({
			category: "navigation",
			data: { from: "/new", to: "/[chatId]" },
		});
	});
});
