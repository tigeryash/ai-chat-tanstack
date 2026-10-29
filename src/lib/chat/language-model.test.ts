import type { LanguageModel } from "ai";
import { describe, expect, it } from "vitest";
import { PROVIDER_IDS } from "@/lib/keys";
import { PROVIDER_API_ORIGINS } from "@/lib/security/provider-origins";
import { createLanguageModel } from "./language-model";
import type { ModelSelection } from "./model-selection";

const KEY = "sk-test-key-abcdefgh1234";

type StreamingModel = Extract<LanguageModel, { doStream: unknown }>;

/** Runs one request through `selection`'s model and returns what it sent, and where. */
async function captureRequest(
	selection: ModelSelection,
	key: string | null,
	localBaseUrl?: string,
) {
	const sent: { url: string; headers: Headers; body: string }[] = [];
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		sent.push({
			url: String(input),
			headers: new Headers(init?.headers),
			body: String(init?.body ?? ""),
		});
		return new Response("{}", { status: 500 });
	}) as typeof fetch;
	const model = createLanguageModel(
		selection,
		key,
		fetchImpl,
		localBaseUrl,
	) as StreamingModel;
	try {
		await model.doStream({
			prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
		});
	} catch {
		// The fake answers 500; only the request matters.
	}
	return sent;
}

describe("createLanguageModel", () => {
	it.each(PROVIDER_IDS)(
		"sends %s's key only to its allowlisted origin, in a header",
		async (provider) => {
			const sent = await captureRequest({ provider, model: "some-model" }, KEY);

			expect(sent.length).toBeGreaterThan(0);
			for (const request of sent) {
				expect(PROVIDER_API_ORIGINS).toContain(new URL(request.url).origin);
				expect(request.url).not.toContain(KEY);
				expect(request.body).not.toContain(KEY);
				expect([...request.headers.values()].join(" ")).toContain(KEY);
			}
		},
	);

	it("adds Anthropic's browser-access header", async () => {
		const [request] = await captureRequest(
			{ provider: "anthropic", model: "claude-test" },
			KEY,
		);
		expect(
			request.headers.get("anthropic-dangerous-direct-browser-access"),
		).toBe("true");
	});

	it("calls the saved local endpoint with no key", async () => {
		const [request] = await captureRequest(
			{ provider: "local", model: "qwen", endpoint: "ep-1" },
			null,
			"http://127.0.0.1:11434/v1",
		);
		expect(request.url).toBe("http://127.0.0.1:11434/v1/chat/completions");
		expect(request.headers.has("authorization")).toBe(false);
	});
});
