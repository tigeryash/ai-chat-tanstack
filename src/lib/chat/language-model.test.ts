import type { LanguageModel } from "ai";
import { describe, expect, it } from "vitest";
import { PROVIDER_IDS } from "@/lib/keys";
import { type ProviderOptions, toCallParams } from "@/lib/params/mapping";
import { PARAM_IDS, REASONING_EFFORTS } from "@/lib/params/registry";
import { PROVIDER_API_ORIGINS } from "@/lib/security/provider-origins";
import { createLanguageModel } from "./language-model";
import type { ModelSelection } from "./model-selection";

const KEY = "sk-test-key-abcdefgh1234";

// Every provider here builds a v4 model; `doStream` on the union of versions would want all their
// provider options at once.
type StreamingModel = Extract<LanguageModel, { specificationVersion: "v4" }>;

/** Runs one request through `selection`'s model and returns what it sent, and where. */
async function captureRequest(
	selection: ModelSelection,
	key: string | null,
	localBaseUrl?: string,
	providerOptions?: ProviderOptions,
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
	const model = (await createLanguageModel(
		selection,
		key,
		fetchImpl,
		localBaseUrl,
	)) as StreamingModel;
	try {
		await model.doStream({
			prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
			providerOptions,
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

	// The mapping test checks what we hand the SDK; this checks what reaches the wire, since
	// `@ai-sdk/openai-compatible` writes some body keys itself and can overwrite ours.
	it("sends every OpenRouter extra in the request body", async () => {
		const { providerOptions } = toCallParams(
			{ provider: "openrouter" },
			{
				topK: 20,
				minP: 0.05,
				repetitionPenalty: 1.1,
				reasoningEffort: "high",
				verbosity: "low",
			},
			{
				params: [...PARAM_IDS],
				reasoningEfforts: [...REASONING_EFFORTS],
			},
		);
		const [request] = await captureRequest(
			{ provider: "openrouter", model: "openai/gpt-test" },
			KEY,
			undefined,
			providerOptions,
		);
		expect(JSON.parse(request.body)).toMatchObject({
			top_k: 20,
			min_p: 0.05,
			repetition_penalty: 1.1,
			reasoning: { effort: "high" },
			verbosity: "low",
		});
	});
});
