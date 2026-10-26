import { describe, expect, it } from "vitest";
import {
	forgetSecret,
	REDACTED,
	redact,
	redactString,
	registerSecret,
} from "@/lib/redact";

describe("redactString", () => {
	it.each([
		["OpenAI", "sk-proj-abcdefghijklmnopqrstuvwxyz0123"],
		["OpenAI legacy", "sk-abcdefghijklmnopqrstuvwx"],
		["Anthropic", "sk-ant-api03-abcdefghijklmnop_qrstu"],
		["OpenRouter", "sk-or-v1-0123456789abcdef0123456789"],
		["Google", "AIzaSyA0123456789abcdefghijklmnopqrstu"],
		["xAI", "xai-abcdefghijklmnopqrstuvwxyz"],
		["Groq", "gsk_abcdefghijklmnopqrstuvwxyz"],
		["Hugging Face", "hf_abcdefghijklmnopqrstuvwxyz"],
		["AI Gateway", "vck_abcdefghijklmnopqrstuvwxyz"],
		["Cerebras", "csk-abcdefghijklmnopqrstuvwxyz"],
		["Together", "tgp_v1_abcdefghijklmnopqrstuvwxyz"],
		["Fireworks", "fw_abcdefghijklmnopqrstuvwxyz"],
		["DeepSeek / Moonshot", "sk-0123456789abcdef0123456789abcdef"],
		[
			"JWT",
			"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N",
		],
	])("removes a %s key", (_, secret) => {
		const scrubbed = redactString(`failed with ${secret} attached`);
		expect(scrubbed).not.toContain(secret);
		expect(scrubbed).toBe(`failed with ${REDACTED} attached`);
	});

	it("keeps the scheme of a bearer header", () => {
		expect(redactString("Authorization: Bearer abc.def-ghi_jkl")).toBe(
			`Authorization: Bearer ${REDACTED}`,
		);
	});

	it.each([
		["x-api-key: 0123456789abcdef", `x-api-key: ${REDACTED}`],
		['{"apiKey":"0123456789"}', `{"apiKey":"${REDACTED}"}`],
		["/reset?token=abcdef123456&next=/", `/reset?token=${REDACTED}&next=/`],
		["password=hunter22", `password=${REDACTED}`],
		['{"code_verifier":"abcdefgh"}', `{"code_verifier":"${REDACTED}"}`],
	])("removes the value in %s", (input, expected) => {
		expect(redactString(input)).toBe(expected);
	});

	it("leaves ordinary text alone", () => {
		const text = "Chat API error: TypeError at /api/chat (status 500)";
		expect(redactString(text)).toBe(text);
	});
});

describe("redact", () => {
	it("replaces secret-named fields and scrubs nested strings without mutating", () => {
		const input = {
			headers: { authorization: "Bearer x", "x-request-id": "r1" },
			nested: [{ note: "key sk-ant-api03-abcdefghijklmnop" }],
			apiKey: "short",
			count: 3,
		};
		const copy = structuredClone(input);

		expect(redact(input)).toEqual({
			headers: { authorization: REDACTED, "x-request-id": "r1" },
			nested: [{ note: `key ${REDACTED}` }],
			apiKey: REDACTED,
			count: 3,
		});
		expect(input).toEqual(copy);
	});

	it("keeps only an error's name and scrubbed message", () => {
		const error = new TypeError("fetch failed for sk-abcdefghijklmnopqrstuv");
		expect(redact(error)).toEqual({
			name: "TypeError",
			message: `fetch failed for ${REDACTED}`,
		});
	});

	it("survives cycles", () => {
		const loop: Record<string, unknown> = { name: "a" };
		loop.self = loop;
		expect(redact(loop)).toEqual({ name: "a", self: "[omitted]" });
	});
});

describe("registered secrets", () => {
	it("scrubs a prefix-less key (Mistral) only once registered", () => {
		// Built at runtime so GitHub's secret scanning doesn't take it for a real Mistral key.
		const mistralKey = ["Fake", "Mistral", "Key", "0123456789", "QrStUw"].join(
			"",
		);
		expect(redactString(mistralKey)).toBe(mistralKey);

		registerSecret(mistralKey);
		expect(redactString(`401 for ${mistralKey}`)).toBe(`401 for ${REDACTED}`);
		expect(redact({ note: mistralKey })).toEqual({ note: REDACTED });

		forgetSecret(mistralKey);
		expect(redactString(mistralKey)).toBe(mistralKey);
	});

	it("ignores strings too short to be a key", () => {
		registerSecret("abc");
		expect(redactString("abc")).toBe("abc");
	});
});
